import base64
import json
import os
import re
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Header, HTTPException, Request as FastAPIRequest
from pydantic import BaseModel, Field

router = APIRouter()

ACTIVATION_AMOUNT = 1000
PHONE_RE = re.compile(r"^254(?:7|1)\d{8}$")


class STKPushRequest(BaseModel):
    phone_number: str = Field(min_length=12, max_length=13)


def _env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise HTTPException(status_code=503, detail=f"Payment service is not configured ({name}).")
    return value


def _request_json(url: str, *, method: str = "GET", headers: dict | None = None, payload: dict | None = None, timeout: int = 20) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        # Do not expose provider response bodies or credentials to clients.
        raise HTTPException(status_code=502, detail=f"Payment provider request failed (HTTP {exc.code}).") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Could not reach the payment provider. Please try again.") from exc


def _supabase_headers(*, bearer: str | None = None) -> dict:
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {bearer or key}",
        "Content-Type": "application/json",
    }
    return headers


def _supabase_rest(path: str, *, method: str = "GET", payload: dict | None = None, prefer: str | None = None) -> list | dict:
    base = _env("SUPABASE_URL").rstrip("/")
    headers = _supabase_headers()
    if prefer:
        headers["Prefer"] = prefer
    return _request_json(
        f"{base}/rest/v1/{path}",
        method=method,
        headers=headers,
        payload=payload,
    )


def _current_user(access_token: str) -> dict:
    base = _env("SUPABASE_URL").rstrip("/")
    anon_key = _env("SUPABASE_ANON_KEY")
    try:
        user = _request_json(
            f"{base}/auth/v1/user",
            headers={"apikey": anon_key, "Authorization": f"Bearer {access_token}"},
        )
    except HTTPException as exc:
        if exc.status_code == 503:
            raise
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.") from exc
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Your session is invalid. Please sign in again.")
    return user


def _daraja_base() -> str:
    environment = (os.getenv("DARAJA_ENV") or "sandbox").strip().lower()
    if environment == "sandbox":
        return "https://sandbox.safaricom.co.ke"
    if environment == "production":
        return "https://api.safaricom.co.ke"
    raise HTTPException(status_code=503, detail="DARAJA_ENV must be sandbox or production.")


def _daraja_access_token() -> str:
    consumer_key = _env("DARAJA_CONSUMER_KEY")
    consumer_secret = _env("DARAJA_CONSUMER_SECRET")
    encoded = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    url = _daraja_base() + "/oauth/v1/generate?" + urlencode({"grant_type": "client_credentials"})
    result = _request_json(url, headers={"Authorization": f"Basic {encoded}"})
    token = result.get("access_token")
    if not token:
        raise HTTPException(status_code=502, detail="Safaricom did not return an access token.")
    return token


def _stk_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}".encode()
    return base64.b64encode(raw).decode()


def _query_stk_status(checkout_id: str, shortcode: str, passkey: str) -> dict:
    """Ask Daraja for the transaction status before trusting a callback."""
    token = _daraja_access_token()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return _request_json(
        _daraja_base() + "/mpesa/stkpushquery/v1/query",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        payload={
            "BusinessShortCode": shortcode,
            "Password": _stk_password(shortcode, passkey, timestamp),
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_id,
        },
    )


@router.post("/stk-push")
def start_stk_push(
    body: STKPushRequest,
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in before starting a payment.")
    access_token = authorization.split(" ", 1)[1].strip()
    user = _current_user(access_token)
    user_id = user["id"]

    raw_phone = body.phone_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if raw_phone.startswith("+"):
        raw_phone = raw_phone[1:]
    if raw_phone.startswith("0"):
        raw_phone = "254" + raw_phone[1:]
    phone = raw_phone
    if not PHONE_RE.fullmatch(phone):
        raise HTTPException(status_code=422, detail="Enter a valid Kenyan Safaricom or M-PESA phone number.")

    # Check the profile server-side; never trust activation state sent by the browser.
    profiles = _supabase_rest(
        f"profiles?id=eq.{user_id}&select=id,activation_status"
    )
    if not isinstance(profiles, list) or not profiles:
        raise HTTPException(status_code=409, detail="Your profile is not ready yet. Refresh and try again.")
    if profiles[0].get("activation_status") == "suspended":
        raise HTTPException(status_code=403, detail="This account is suspended. Contact support.")
    if profiles[0].get("activation_status") == "active":
        return {"message": "Your account is already activated.", "already_active": True}

    # Prevent repeated prompts while a previous request is awaiting its callback.
    pending = _supabase_rest(
        f"mpesa_payments?user_id=eq.{user_id}&status=eq.pending&select=id&limit=1"
    )
    if isinstance(pending, list) and pending:
        raise HTTPException(status_code=409, detail="A payment request is already pending. Complete it or wait for its result before retrying.")

    environment = (os.getenv("DARAJA_ENV") or "sandbox").strip().lower()
    shortcode = (os.getenv("DARAJA_SHORTCODE") or ("174379" if environment == "sandbox" else "")).strip()
    passkey = _env("DARAJA_PASSKEY")
    callback_url = _env("STK_CALLBACK_URL")
    if not shortcode:
        raise HTTPException(status_code=503, detail="DARAJA_SHORTCODE is required in production.")
    if environment == "production" and not callback_url.startswith("https://"):
        raise HTTPException(status_code=503, detail="STK_CALLBACK_URL must be a public HTTPS URL in production.")
    if environment == "production" and not (os.getenv("PUBLIC_BASE_URL") or "").startswith("https://"):
        raise HTTPException(status_code=503, detail="PUBLIC_BASE_URL must be a public HTTPS URL in production.")

    till_number = (os.getenv("DARAJA_TILL_NUMBER") or "").strip()
    if not till_number:
        raise HTTPException(status_code=503, detail="DARAJA_TILL_NUMBER is required for Buy Goods STK Push.")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    token = _daraja_access_token()
    result = _request_json(
        _daraja_base() + "/mpesa/stkpush/v1/processrequest",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        payload={
            "BusinessShortCode": shortcode,
            "Password": _stk_password(shortcode, passkey, timestamp),
            "Timestamp": timestamp,
            "TransactionType": "CustomerBuyGoodsOnline",
            "Amount": ACTIVATION_AMOUNT,
            "PartyA": phone,
            "PartyB": till_number,
            "PhoneNumber": phone,
            "CallBackURL": callback_url,
            "AccountReference": "AlgoGuardian",
            "TransactionDesc": "AlgoGuardian activation",
        },
    )

    checkout_id = result.get("CheckoutRequestID")
    merchant_id = result.get("MerchantRequestID")
    if str(result.get("ResponseCode")) != "0" or not checkout_id:
        raise HTTPException(status_code=502, detail=result.get("ResponseDescription") or "Safaricom did not accept the STK Push request.")

    _supabase_rest(
        "mpesa_payments",
        method="POST",
        payload={
            "user_id": user_id,
            "phone_number": phone,
            "amount": ACTIVATION_AMOUNT,
            "currency": "KES",
            "status": "pending",
            "checkout_request_id": checkout_id,
            "merchant_request_id": merchant_id,
        },
        prefer="return=minimal",
    )
    return {
        "message": "STK Push sent. Enter your M-Pesa PIN on your phone, then check your activation status.",
        "checkout_request_id": checkout_id,
    }


@router.post("/callback")
async def mpesa_callback(request: FastAPIRequest):
    # Safaricom sends this callback without the user's browser session.
    try:
        body = await request.json()
        callback = body["Body"]["stkCallback"]
        checkout_id = str(callback["CheckoutRequestID"])
        result_code = int(callback["ResultCode"])
    except (ValueError, TypeError, KeyError):
        # Acknowledge malformed callbacks to avoid repeated delivery; never activate.
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    matches = _supabase_rest(
        f"mpesa_payments?checkout_request_id=eq.{checkout_id}&select=id,user_id,phone_number,amount,status"
    )
    if not isinstance(matches, list) or not matches:
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    payment = matches[0]
    if payment.get("status") != "pending":
        return {"ResultCode": 0, "ResultDesc": "Callback already processed"}

    environment = (os.getenv("DARAJA_ENV") or "sandbox").strip().lower()
    shortcode = (os.getenv("DARAJA_SHORTCODE") or ("174379" if environment == "sandbox" else "")).strip()
    passkey = _env("DARAJA_PASSKEY")
    if not shortcode:
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    try:
        query_result = _query_stk_status(checkout_id, shortcode, passkey)
    except HTTPException:
        # A temporary Daraja query failure must never cause activation.
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    # Daraja's query endpoint must independently confirm a successful transaction.
    if str(query_result.get("ResponseCode")) != "0" or str(query_result.get("ResultCode")) != "0":
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    if result_code != 0:
        _supabase_rest(
            f"mpesa_payments?id=eq.{payment['id']}&status=eq.pending",
            method="PATCH",
            payload={"status": "failed", "result_code": result_code, "result_description": str(callback.get("ResultDesc", ""))[:250]},
            prefer="return=minimal",
        )
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    metadata_items = callback.get("CallbackMetadata", {}).get("Item", [])
    metadata = {item.get("Name"): item.get("Value") for item in metadata_items if isinstance(item, dict) and item.get("Name")}
    try:
        paid_amount = int(float(metadata.get("Amount", 0)))
        receipt = str(metadata["MpesaReceiptNumber"])
        paid_phone = str(int(metadata["PhoneNumber"]))
    except (ValueError, TypeError, KeyError):
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    if paid_amount != ACTIVATION_AMOUNT or paid_amount != int(payment.get("amount", 0)) or paid_phone != payment.get("phone_number"):
        _supabase_rest(
            f"mpesa_payments?id=eq.{payment['id']}&status=eq.pending",
            method="PATCH",
            payload={"status": "review", "result_code": result_code, "result_description": "Callback amount or phone did not match the pending payment."},
            prefer="return=minimal",
        )
        return {"ResultCode": 0, "ResultDesc": "Callback received"}

    # Persist the unique receipt before activating. Duplicate receipts cannot be reused.
    _supabase_rest(
        f"mpesa_payments?id=eq.{payment['id']}&status=eq.pending",
        method="PATCH",
        payload={
            "status": "paid",
            "mpesa_receipt_number": receipt,
            "result_code": result_code,
            "result_description": str(callback.get("ResultDesc", ""))[:250],
            "transaction_date": str(metadata.get("TransactionDate", "")),
        },
        prefer="return=minimal",
    )
    # Activation is server-only; the browser cannot edit this column.
    _supabase_rest(
        f"profiles?id=eq.{payment['user_id']}&activation_status=eq.pending",
        method="PATCH",
        payload={"activation_status": "active", "updated_at": datetime.now().astimezone().isoformat()},
        prefer="return=minimal",
    )
    return {"ResultCode": 0, "ResultDesc": "Callback received"}
