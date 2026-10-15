import React from "react";
import { ShieldCheck, TrendingUp } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#07090f] text-white">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[1fr_0.9fr]">
        <section className="hidden flex-col justify-between border-r border-white/10 p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-300">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-wide">AlgoGuardian</span>
          </div>
          <div className="max-w-md">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Precision. Discipline. Control.</p>
            <h1 className="text-5xl font-semibold leading-tight">Your trading workspace, guarded.</h1>
            <p className="mt-5 leading-7 text-slate-400">Manage your subscription, connect your MT5 account, and monitor your trading from one secure workspace.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4 text-amber-300" /> Secure account access</div>
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-300"><TrendingUp className="h-5 w-5" /></div>
              <span className="text-lg font-bold tracking-wide">AlgoGuardian</span>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
