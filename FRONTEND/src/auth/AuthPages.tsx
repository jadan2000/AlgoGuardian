import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "./AuthLayout";
import { useAuth } from "./AuthProvider";
import { supabase } from "./supabase";

function AuthError({ message }: { message: string }) {
  return <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{message}</div>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-200">
      <span>{label}</span>
      <input {...props} className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/10 disabled:opacity-60" />
    </label>
  );
}

export function SignInPage() {
  const { user, profile, loading, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <AuthLayout><div className="text-center text-slate-400">Loading your account…</div></AuthLayout>;
  if (user) return <Navigate to={profile?.activation_status === "active" ? "/" : "/activation"} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!supabase) return setError("Authentication is not configured yet. Add the Supabase environment variables to the frontend.");
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) return setError(authError.message);
    navigate("/activation", { replace: true });
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Welcome back</p>
        <h2 className="text-3xl font-semibold tracking-tight">Sign in to your account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Access your AlgoGuardian trading workspace.</p>
      </div>
      {!configured && <AuthError message="Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to FRONTEND/.env.local." />}
      <form onSubmit={submit} className="mt-6 space-y-5">
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <div className="space-y-2">
          <div className="relative">
            <Field label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-9 text-slate-400 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="text-right"><Link className="text-sm text-amber-300 hover:text-amber-200" to="/forgot-password">Forgot password?</Link></div>
        </div>
        {error && <AuthError message={error} />}
        <button disabled={busy || !configured} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Sign in <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">New to AlgoGuardian? <Link to="/register" className="font-semibold text-amber-300 hover:text-amber-200">Create an account</Link></p>
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" /> Your account is protected.</p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { user, profile, loading, configured } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const AGREEMENT_VERSION = "1.0";
  const [agreementOpen, setAgreementOpen] = useState(true);

  if (loading) return <AuthLayout><div className="text-center text-slate-400">Loading your account…</div></AuthLayout>;
  if (user) return <Navigate to={profile?.activation_status === "active" ? "/" : "/activation"} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!agreementAccepted) {
      setAgreementOpen(true);
      return setError("Please read and accept the AlgoGuardian Agreement before creating your account.");
    }
    if (!supabase) return setError("Authentication is not configured yet. Add the Supabase environment variables to the frontend.");
    if (password !== confirmPassword) return setError("Your passwords do not match.");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (authError) return setError(authError.message);
    if (!data.session || !data.user) {
      return setError("Your account was created, but agreement acceptance could not be recorded because no active session was returned. Sign in and contact support before using AlgoGuardian.");
    }
    const { error: acceptanceError } = await supabase
      .from("agreement_acceptances")
      .insert({
        user_id: data.user.id,
        agreement_version: AGREEMENT_VERSION,
      });
    if (acceptanceError) {
      return setError("Your account was created, but we could not securely record your agreement acceptance. Please sign in and contact support before using AlgoGuardian.");
    }
    toast.success("Account created successfully.");
    navigate("/activation", { replace: true });
  };

  return (
    <AuthLayout>
      {agreementOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/85 px-5 py-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="agreement-title">
          <section className="my-auto flex h-[calc(100vh-160px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-300/25 bg-slate-950">
            <header className="border-b border-white/10 px-5 py-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Please read before continuing</p>
              <h2 id="agreement-title" className="text-2xl font-semibold tracking-tight text-white">AlgoGuardian Agreement</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Review these important terms before creating your account.</p>
            </header>
            <div className="space-y-5 overflow-y-auto px-5 py-5 text-base leading-7 text-slate-300">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Version 1.0</p>
              <section>
                <h3 className="mb-1 font-semibold text-white">Trading risk</h3>
                <p>Forex, contracts for difference (CFDs), leverage and automated trading are high-risk and may cause rapid losses, including the loss of all money in your trading account. You may lose more than expected due to leverage, market gaps, slippage, spreads, swaps, liquidity, execution or broker rules. Never trade money you cannot afford to lose. No strategy, risk setting, test or past result guarantees future performance or limits your loss to a particular amount.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">What you authorise</h3>
                <p>If you connect and enable AlgoGuardian for a broker/MetaTrader 5 account, you authorise the software to submit, modify and close trading orders on that account according to the strategy, settings and controls you select. You remain the account holder and are responsible for reviewing the strategy and settings, confirming the correct account is connected, monitoring activity and deciding whether to enable or stop automation. Do not connect an account or enable trading unless you understand and accept this authority. This agreement does not transfer ownership of your funds to AlgoGuardian.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">No advice or promised results</h3>
                <p>AlgoGuardian is software, not a promise of profit. Unless expressly agreed in a separate written agreement and lawfully authorised, the service does not provide personalised investment advice, portfolio management advice, tax advice or legal advice. You make your own trading and funding decisions. Examples, demonstrations, backtests and simulated results may differ materially from live trading.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">Your responsibilities</h3>
                <p>You must provide accurate information, use an account you are authorised to control, keep your login details and devices secure, choose appropriate settings, maintain sufficient margin, and comply with your broker's terms and applicable law. Test with a demo account before live use. Regularly check your broker account directly; never rely solely on the app to confirm positions, orders, balances or that automation has stopped.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">Service limits and third parties</h3>
                <p>The service may be unavailable, delayed or inaccurate because of software errors, maintenance, internet or power failures, device or terminal shutdowns, broker/platform restrictions, market conditions or third-party services. Orders may be rejected, delayed, duplicated or executed at a different price; stops and other risk controls may fail or execute at a worse price. We do not control brokers or markets and cannot guarantee uninterrupted service, successful execution, data accuracy or that a stop command will cancel every pending order or close every position. Where safe and practical, verify and manage positions directly through your broker.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">Fees, suspension and termination</h3>
                <p>You are responsible for broker spreads, commissions, swaps, financing charges, taxes and any service fees disclosed to you. We may restrict, suspend or discontinue access where reasonably necessary for security, maintenance, suspected misuse, non-payment or legal compliance. You may stop using the service and disable automation, but stopping the software does not necessarily close existing positions or cancel pending orders; check your broker account and manage them yourself.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">Liability</h3>
                <p>To the fullest extent permitted by applicable law, AlgoGuardian is not liable for indirect, incidental, special or consequential loss, lost profits, lost opportunities, trading losses, or losses caused by brokers, markets, connectivity, devices or other third parties. Nothing in this agreement excludes or limits liability, rights or remedies that cannot lawfully be excluded or limited, including liability for fraud or wilful misconduct where exclusion is prohibited. This agreement does not guarantee compensation for trading losses and does not remove any rights you have under mandatory consumer or other applicable law.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">Law and disputes</h3>
                <p>This agreement is governed by the laws of Kenya, except where mandatory law requires otherwise. If a dispute arises, the parties should first try to resolve it in good faith. This does not prevent either party from seeking relief from a court or using any complaint or remedy available under applicable law.</p>
              </section>
              <section>
                <h3 className="mb-1 font-semibold text-white">Acceptance</h3>
                <p>By ticking the box and continuing, you confirm that you have read and understood this agreement, understand that AlgoGuardian may place and manage orders when you enable automated trading, and voluntarily accept the risks and terms above. If you do not agree, do not create an account or enable the service. If any term is unenforceable, the remaining terms continue to apply to the extent permitted by law.</p>
              </section>
            </div>
            <footer className="border-t border-white/10 bg-white/[0.02] px-5 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-200">
                  <input type="checkbox" checked={agreementAccepted} onChange={event => setAgreementAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-300" />
                  <span>I have read and agree to the AlgoGuardian Agreement.</span>
                </label>
                <button type="button" disabled={!agreementAccepted} onClick={() => setAgreementOpen(false)} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-300 px-5 font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
      <div className={agreementOpen ? "pointer-events-none select-none blur-[2px]" : ""} aria-hidden={agreementOpen}>
      <div className="mb-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Get started</p>
        <h2 className="text-3xl font-semibold tracking-tight">Create your account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Set up your AlgoGuardian login in a few steps.</p>
      </div>
      {!configured && <AuthError message="Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to FRONTEND/.env.local." />}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" type="text" autoComplete="name" placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} maxLength={100} />
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <div className="relative">
          <Field label="Password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-9 text-slate-400 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
        <Field label="Confirm password" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
        <p className="text-xs leading-5 text-slate-500">No email confirmation is required. After creating your account, continue to activation.</p>
        {error && <AuthError message={error} />}
        <button disabled={busy || !configured} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Create account <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">Already have an account? <Link to="/login" className="font-semibold text-amber-300 hover:text-amber-200">Sign in</Link></p>
      </div>
    </AuthLayout>
  );
}

export function ActivationPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [error, setError] = useState("");

  if (loading) return <AuthLayout><div className="text-center text-slate-400">Loading your account…</div></AuthLayout>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.activation_status === "active") return <Navigate to="/" replace />;

  const stkApiBase = "https://algoguardian-stk-api.onrender.com";
  const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

  const pollForActivation = async () => {
    setProcessing(true);
    setRetryAvailable(false);
    setPaymentMessage("Processing payment… Please approve the M-Pesa prompt on your phone.");
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await wait(3_000);
      try {
        const next = await refreshProfile();
        if (next?.activation_status === "active") {
          toast.success("Your account is activated.");
          window.location.assign("/");
          return;
        }
      } catch {
        // Keep polling until the 30-second verification window ends.
      }
    }
    setProcessing(false);
    setRetryAvailable(true);
    setPaymentMessage("");
    setError("Payment not verified.");
  };

  const startPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPaymentMessage("");
    setRetryAvailable(false);
    if (!supabase) {
      setError("Authentication is not configured. Please contact support.");
      return;
    }
    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    if (!/^(?:\+254|254|0)[17]\d{8}$/.test(normalizedPhone)) {
      setError("Enter a valid Kenyan M-Pesa number, for example 0712345678.");
      return;
    }
    const mpesaPhone = normalizedPhone.startsWith("+") ? normalizedPhone.slice(1) : normalizedPhone.startsWith("0") ? "254" + normalizedPhone.slice(1) : normalizedPhone;
    setPaying(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch(stkApiBase + "/api/website/stk-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
        },
        body: JSON.stringify({ phone_number: mpesaPhone }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || result.message || "Could not start M-Pesa payment.");
      setPaymentMessage(result.message || "STK Push sent.");
      toast.success("M-Pesa payment request sent.");
      void pollForActivation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not be started.");
    } finally {
      setPaying(false);
    }
  };

  const status = profile?.activation_status === "suspended" ? "Account suspended" : "Activate your account";
  const description = profile?.activation_status === "suspended"
    ? "Access is currently paused. Contact support for assistance."
    : "Pay the one-time activation fee to unlock your AlgoGuardian trading workspace.";

  return (
    <AuthLayout>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Account activation</p>
      <h2 className="text-3xl font-semibold tracking-tight">{status}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
        <p className="text-sm text-slate-400">Activation fee</p>
        <p className="mt-1 text-3xl font-semibold text-amber-300">KSh 1</p>
        <p className="mt-2 text-xs text-slate-500">Pay securely through M-Pesa STK Push.</p>
      </div>
      {profile?.activation_status !== "suspended" && <>
        <form onSubmit={startPayment} className="mt-6 space-y-4">
          <Field label="M-Pesa phone number" type="tel" autoComplete="tel" inputMode="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)} required />
          {error && <AuthError message={error} />}
          {paymentMessage && <div role="status" aria-live="polite" className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{processing && <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />} {paymentMessage}</div>}
          <button type="submit" disabled={paying || processing} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 font-semibold text-black hover:bg-amber-200 disabled:opacity-50">
            {paying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {paying ? "Sending STK Push…" : processing ? "Processing payment…" : retryAvailable ? "Try again" : "Pay KSh 1 with M-Pesa"}
          </button>
        </form>
  
      </>}
      <button onClick={() => void signOut().then(() => window.location.assign("/login")).catch(e => toast.error(e.message))} className="mt-3 w-full rounded-lg border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">Sign out</button>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return setError("Supabase is not configured.");
    setError(""); setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/reset-password" });
    setBusy(false);
    if (resetError) setError(resetError.message); else setSent(true);
  };
  return <AuthLayout>
    <div className="mb-7"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Account recovery</p><h2 className="text-3xl font-semibold">Reset password</h2><p className="mt-2 text-sm text-slate-400">Enter your account email to request a password reset.</p></div>
    {sent ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">If an account exists for that email, a password reset message has been requested.</div> : <form onSubmit={submit} className="space-y-5"><Field label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" />{error && <AuthError message={error} />}<button disabled={busy} className="h-11 w-full rounded-lg bg-amber-300 font-semibold text-black disabled:opacity-50">{busy ? "Sending…" : "Send reset link"}</button></form>}
    <p className="mt-6 text-center text-sm text-slate-400"><Link to="/login" className="text-amber-300">Back to sign in</Link></p>
  </AuthLayout>;
}


export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!supabase) return setError("Supabase is not configured.");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirmPassword) return setError("Your passwords do not match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else setDone(true);
  };

  return <AuthLayout>
    <div className="mb-7"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Account recovery</p><h2 className="text-3xl font-semibold">Choose a new password</h2><p className="mt-2 text-sm text-slate-400">Set a new password for your AlgoGuardian account.</p></div>
    {done ? <div className="space-y-4"><div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">Your password has been updated.</div><Link to="/login" className="block rounded-lg bg-amber-300 px-4 py-3 text-center font-semibold text-black">Back to sign in</Link></div> : <form onSubmit={submit} className="space-y-4"><Field label="New password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" /><Field label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} placeholder="Re-enter new password" />{error && <AuthError message={error} />}<button disabled={busy} className="h-11 w-full rounded-lg bg-amber-300 font-semibold text-black disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button></form>}
    <p className="mt-6 text-center text-sm text-slate-400"><Link to="/login" className="text-amber-300">Back to sign in</Link></p>
  </AuthLayout>;
}
