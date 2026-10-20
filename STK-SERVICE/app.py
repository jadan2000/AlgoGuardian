import base64
import hmac
import json
import logging
import os
import re
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote, urlsplit
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

logger = logging.getLogger("algoguardian.stk")

app = FastAPI(title="AlgoGuardian STK Payments API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(
        [origin.strip().rstrip("/") for origin in (os.getenv("FRONTEND_ORIGINS") or "").split(",") if origin.strip()]
        + ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"]
    )),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

# Temporary test fee only. Restore to 1000 before production launch.
ACTIVATION_AMOUNT = 1
PHONE_RE = re.compile(r"^254(?:7|1)\d{8}$")


class STKPushRequest(BaseModel):
    phone_number: str = Field(min_length=9, max_length=16)


def env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise HTTPException(status_code=503, detail=f"Payment service is not configured: {name}")
    return value


def json_request(url: str, method: str = "GET", headers: dict | None = None, payload: dict | None = None, timeout: int = 20):
    data = json.dumps(payload).encode() if payload is not None else None
    request = Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        parsed = urlsplit(url)
        host = parsed.hostname or "upstream"
        # Log only upstream location, status, and a short response excerpt.
        # Never log request headers, bearer tokens, API keys, or request payloads.
        try:
            upstream_body = exc.read(1200).decode("utf-8", errors="replace")
            upstream_body = re.sub(
                r'(?i)(access_token|refresh_token|client_secret|consumer_secret|passkey|password|authorization|apikey|service_role_key)(["\\s:=]+)[^,"\\s}]+',
                r'\1\2[REDACTED]',
                upstream_body,
            )
            upstream_body = upstream_body[:600]
        except Exception:
            upstream_body = "[response body unavailable]"
        logger.warning(
            "Upstream HTTP error: host=%s path=%s status=%s response=%s",
            host, parsed.path, exc.code, upstream_body,
        )
        raise HTTPException(status_code=502, detail=f"Upstream request failed (HTTP {exc.code}) at {host}.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        parsed = urlsplit(url)
        host = parsed.hostname or "upstream"
        logger.warning(
            "Upstream connection/response error: host=%s path=%s error_type=%s",
            host, parsed.path, type(exc).__name__,
        )
        raise HTTPException(status_code=502, detail=f"Could not reach or parse response from {host}.") from exc


def daraja_base() -> str:
    mode = (os.getenv("DARAJA_ENV") or "production").strip().lower()
    if mode == "production":
        return "https://api.safaricom.co.ke"
    if mode == "sandbox":
        return "https://sandbox.safaricom.co.ke"
    raise HTTPException(status_code=503, detail="DARAJA_ENV must be production or sandbox.")


def daraja_token() -> str:
    credentials = base64.b64encode(
        f"{env('DARAJA_CONSUMER_KEY')}:{env('DARAJA_CONSUMER_SECRET')}".encode()
    ).decode()
    result = json_request(
        daraja_base() + "/oauth/v1/generate?" + urlencode({"grant_type": "client_credentials"}),
        headers={"Authorization": f"Basic {credentials}"},
    )
    if not result.get("access_token"):
        raise HTTPException(status_code=502, detail="Safaricom authentication did not return a token.")
    return result["access_token"]


def shortcode() -> str:
    value = (os.getenv("DARAJA_SHORTCODE") or "").strip()
    if not value:
        raise HTTPException(status_code=503, detail="DARAJA_SHORTCODE is required.")
    return value


def stk_password(timestamp: str) -> str:
    raw = f"{shortcode()}{env('DARAJA_PASSKEY')}{timestamp}".encode()
    return base64.b64encode(raw).decode()


def supabase_request(path: str, method: str = "GET", payload: dict | None = None, prefer: str | None = None):
    base = env("SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    return json_request(f"{base}/rest/v1/{path}", method=method, headers=headers, payload=payload)


def normalize_phone(value: str) -> str:
    phone = re.sub(r"[\s()\-]", "", value)
    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    if not PHONE_RE.fullmatch(phone):
        raise HTTPException(status_code=422, detail="Enter a valid Kenyan mobile number in 07…, 01…, or 254… format.")
    return phone


def current_supabase_user(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    token = authorization.split(" ", 1)[1].strip()
    user = json_request(
        env("SUPABASE_URL").rstrip("/") + "/auth/v1/user",
        headers={"apikey": env("SUPABASE_ANON_KEY"), "Authorization": f"Bearer {token}"},
    )
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Sign in again.")
    return user


def check_api_key(provided: str | None):
    expected = env("STK_API_KEY")
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Unauthorized.")


@app.get("/health")
def health():
    return {"status": "ok", "service": "algoguardian-stk-api"}


@app.post("/api/stk-push")
def start_stk_push(body: STKPushRequest, x_api_key: str | None = Header(default=None)):
    check_api_key(x_api_key)
    return _start_stk_push(body, user_id=None)


@app.post("/api/website/stk-push")
def website_stk_push(body: STKPushRequest, authorization: str | None = Header(default=None)):
    user = current_supabase_user(authorization)
    return _start_stk_push(body, user_id=user["id"])


def _start_stk_push(body: STKPushRequest, user_id: str | None):
    phone = normalize_phone(body.phone_number)
    till = env("DARAJA_TILL_NUMBER")
    callback_url = env("STK_CALLBACK_URL")
    public_base = env("PUBLIC_BASE_URL")
    if (os.getenv("DARAJA_ENV") or "production").strip().lower() == "production":
        if not callback_url.startswith("https://") or not public_base.startswith("https://"):
            raise HTTPException(status_code=503, detail="Production callback and public base URLs must use HTTPS.")
    if callback_url.rstrip("/") != (public_base.rstrip("/") + "/api/payments/callback"):
        raise HTTPException(status_code=503, detail="STK_CALLBACK_URL must be PUBLIC_BASE_URL/api/payments/callback.")

    # Persist an initiating record before contacting Daraja.
    rows = supabase_request(
        "stk_transactions",
        method="POST",
        payload={"phone_number": phone, "amount": ACTIVATION_AMOUNT, "status": "initiating", **({"user_id": user_id} if user_id else {})},
        prefer="return=representation",
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=502, detail="Could not create payment record.")
    transaction_id = rows[0]["id"]

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    token = daraja_token()
    result = json_request(
        daraja_base() + "/mpesa/stkpush/v1/processrequest",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        payload={
            "BusinessShortCode": shortcode(),
            "Password": stk_password(timestamp),
            "Timestamp": timestamp,
            "TransactionType": "CustomerBuyGoodsOnline",
            "Amount": ACTIVATION_AMOUNT,
            "PartyA": phone,
            "PartyB": till,
            "PhoneNumber": phone,
            "CallBackURL": callback_url,
            "AccountReference": "AlgoGuardian",
            "TransactionDesc": "AlgoGuardian activation",
        },
    )
    checkout_id = result.get("CheckoutRequestID")
    if str(result.get("ResponseCode")) != "0" or not checkout_id:
        supabase_request(
            f"stk_transactions?id=eq.{quote(transaction_id)}",
            method="PATCH",
            payload={"status": "failed", "result_description": str(result.get("ResponseDescription", "Daraja rejected request"))[:250]},
            prefer="return=minimal",
        )
        raise HTTPException(status_code=502, detail=result.get("ResponseDescription") or "Safaricom did not accept the STK Push request.")

    supabase_request(
        f"stk_transactions?id=eq.{quote(transaction_id)}",
        method="PATCH",
        payload={
            "status": "pending",
            "checkout_request_id": checkout_id,
            "merchant_request_id": result.get("MerchantRequestID"),
        },
        prefer="return=minimal",
    )
    return {"ok": True, "message": "STK Push sent. Enter your M-Pesa PIN on your phone.", "amount": ACTIVATION_AMOUNT, "currency": "KES", "checkout_request_id": checkout_id}


def query_stk(checkout_id: str):
    token = daraja_token()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return json_request(
        daraja_base() + "/mpesa/stkpushquery/v1/query",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        payload={
            "BusinessShortCode": shortcode(),
            "Password": stk_password(timestamp),
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_id,
        },
    )


@app.post("/api/payments/callback")
async def payment_callback(request: FastAPIRequest):
    try:
        body = await request.json()
        callback = body["Body"]["stkCallback"]
        checkout_id = str(callback["CheckoutRequestID"])
        callback_code = int(callback["ResultCode"])
    except (ValueError, TypeError, KeyError):
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    rows = supabase_request(
        "stk_transactions?" + urlencode({
            "checkout_request_id": f"eq.{checkout_id}",
            "select": "id,user_id,phone_number,amount,status",
            "limit": "1",
        })
    )
    if not isinstance(rows, list) or not rows or rows[0].get("status") != "pending":
        return {"ResultCode": 0, "ResultDesc": "Callback received"}
    payment = rows[0]

    # Query Daraja independently; never activate or mark paid from callback alone.
    try:
        verified = query_stk(checkout_id)
    except HTTPException:
        return {"ResultCode": 0, "ResultDesc": "Callback received"}
    if str(verified.get("ResponseCode")) != "0" or str(verified.get("ResultCode")) != "0":
        if callback_code != 0:
            supabase_request(
                f"stk_transactions?id=eq.{quote(payment['id'])}&status=eq.pending",
                method="PATCH",
                payload={"status": "failed", "result_code": callback_code, "result_description": str(callback.get("ResultDesc", ""))[:250]},
                prefer="return=minimal",
            )
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    items = callback.get("CallbackMetadata", {}).get("Item", [])
    metadata = {item.get("Name"): item.get("Value") for item in items if isinstance(item, dict) and item.get("Name")}
    try:
        amount = int(float(metadata.get("Amount", 0)))
        receipt = str(metadata["MpesaReceiptNumber"])
        paid_phone = str(int(metadata["PhoneNumber"]))
    except (ValueError, TypeError, KeyError):
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    if amount != ACTIVATION_AMOUNT or amount != int(payment["amount"]) or paid_phone != payment["phone_number"]:
        supabase_request(
            f"stk_transactions?id=eq.{quote(payment['id'])}&status=eq.pending",
            method="PATCH",
            payload={"status": "review", "result_code": callback_code, "result_description": "Payment amount or phone mismatch."},
            prefer="return=minimal",
        )
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    supabase_request(
        f"stk_transactions?id=eq.{quote(payment['id'])}&status=eq.pending",
        method="PATCH",
        payload={
            "status": "paid",
            "mpesa_receipt_number": receipt,
            "result_code": callback_code,
            "result_description": str(callback.get("ResultDesc", ""))[:250],
        },
        prefer="return=minimal",
    )
    # Only website-originated transactions are tied to an account. Activate after
    # successful Daraja query plus amount, phone, and receipt validation above.
    user_id = payment.get("user_id")
    if user_id:
        supabase_request(
            f"profiles?id=eq.{quote(str(user_id))}",
            method="PATCH",
            payload={"activation_status": "active"},
            prefer="return=minimal",
        )
    return {"ResultCode": 0, "ResultDesc": "Callback received"}
