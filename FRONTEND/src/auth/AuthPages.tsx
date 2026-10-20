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
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" /> Your account is protected with secure authentication.</p>
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

  if (loading) return <AuthLayout><div className="text-center text-slate-400">Loading your account…</div></AuthLayout>;
  if (user) return <Navigate to={profile?.activation_status === "active" ? "/" : "/activation"} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
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
    if (!data.session) {
      return setError("Supabase is still requiring email confirmation. In Supabase Dashboard, turn off Confirm email under Authentication settings, then register again.");
    }
    toast.success("Account created successfully.");
    navigate("/activation", { replace: true });
  };

  return (
    <AuthLayout>
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
    </AuthLayout>
  );
}

export function ActivationPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [error, setError] = useState("");

  if (loading) return <AuthLayout><div className="text-center text-slate-400">Loading your account…</div></AuthLayout>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.activation_status === "active") return <Navigate to="/" replace />;

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  const checkStatus = async () => {
    setChecking(true);
    try {
      const next = await refreshProfile();
      if (next?.activation_status === "active") {
        toast.success("Your account is activated.");
        window.location.assign("/");
      } else if (!next) {
        toast.error("We could not load your activation status. Check your Supabase setup.");
      } else {
        toast.info("Your payment or activation is still being processed.");
      }
    } finally {
      setChecking(false);
    }
  };

  const startPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPaymentMessage("");
    if (!apiBase) {
      setError("Payment service is not configured. Please contact support.");
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
      const response = await fetch(apiBase + "/api/payments/stk-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(supabase ? { Authorization: "Bearer " + (await supabase.auth.getSession()).data.session?.access_token } : {}),
        },
        body: JSON.stringify({ phone_number: mpesaPhone }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || result.message || "Could not start M-Pesa payment.");
      setPaymentMessage(result.message || "STK Push sent. Enter your M-Pesa PIN on your phone, then check your activation status.");
      toast.success("M-Pesa payment request sent.");
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
        <p className="mt-1 text-3xl font-semibold text-amber-300">KSh 1,000</p>
        <p className="mt-2 text-xs text-slate-500">Pay securely through M-Pesa STK Push.</p>
      </div>
      {profile?.activation_status !== "suspended" && <>
        <form onSubmit={startPayment} className="mt-6 space-y-4">
          <Field label="M-Pesa phone number" type="tel" autoComplete="tel" inputMode="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)} required />
          {error && <AuthError message={error} />}
          {paymentMessage && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{paymentMessage}</div>}
          <button type="submit" disabled={paying} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 font-semibold text-black hover:bg-amber-200 disabled:opacity-50">
            {paying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {paying ? "Sending STK Push…" : "Pay KSh 1,000 with M-Pesa"}
          </button>
        </form>
        <button onClick={() => void checkStatus()} disabled={checking} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50">
          {checking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Check payment / activation status
        </button>
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
