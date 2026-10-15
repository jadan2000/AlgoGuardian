import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import AuthLayout from "./AuthLayout";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLayout><div className="py-8 text-center text-slate-400">Loading your secure workspace…</div></AuthLayout>;
  if (!configured) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profile?.activation_status !== "active") return <Navigate to="/activation" replace />;
  return <>{children}</>;
}
