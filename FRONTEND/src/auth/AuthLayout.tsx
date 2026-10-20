import React from "react";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-enter min-h-screen bg-[#07090f] text-white">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[1fr_0.9fr]">
        <section className="hidden flex-col justify-between border-r border-white/10 p-10 lg:flex">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="AlgoGuardian logo" className="h-11 w-11 rounded-xl object-contain" />
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
              <img src="/favicon.svg" alt="AlgoGuardian logo" className="h-10 w-10 rounded-xl object-contain" />
              <span className="text-lg font-bold tracking-wide">AlgoGuardian</span>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
