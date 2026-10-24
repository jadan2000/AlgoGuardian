import {
  BarChart3,
  LineChart,
  Settings,
  FileText,
  WalletCards,
  BookOpen,
  CheckCircle2,
} from "lucide-react";

type Props = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export default function Sidebar({ activeTab, setActiveTab }: Props) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "analytics", label: "Analytics", icon: LineChart },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "logs", label: "Activity logs", icon: FileText },
    { id: "accounts", label: "Accounts", icon: WalletCards },
    { id: "requirements", label: "Requirements", icon: CheckCircle2 },
    { id: "how-to-use", label: "How to use", icon: BookOpen },
  ];

  const navItems = (mobile = false) => items.map((item) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveTab(item.id)}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
          mobile ? "shrink-0 px-3.5 py-2.5" : "w-full px-3.5 py-3"
        } ${
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "" : "opacity-75 group-hover:opacity-100"}`} />
        {item.label}
        {!mobile && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      </button>
    );
  });

  return (
    <>
      <aside className="hidden md:flex w-[252px] shrink-0 flex-col border-r border-border bg-card">
        <div className="px-5 pt-6 pb-4">
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-border/70 bg-black/20 p-3">
            <img src="/favicon.svg" alt="AlgoGuardian bull emblem" className="h-11 w-11 rounded-lg object-cover" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-wide text-foreground">ALGO<span className="text-primary">GUARDIAN</span></div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.22em] text-muted-foreground">Automated trading</div>
            </div>
          </div>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground/70">Workspace</p>
          <nav className="space-y-1.5">{navItems()}</nav>
        </div>
        <div className="mt-auto p-5">
          <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[.07] to-transparent p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> DISCIPLINE FIRST</div>
            <p className="text-xs leading-relaxed text-muted-foreground">Stay protected. Trade with a plan.</p>
          </div>
          <p className="mt-4 text-center text-[10px] tracking-wider text-muted-foreground/50">ALGOGUARDIAN · CONTROL CENTER</p>
        </div>
      </aside>
      <div className="w-full border-b border-border bg-card md:hidden">
        <nav aria-label="Main navigation" className="flex gap-2 overflow-x-auto p-2.5">{navItems(true)}</nav>
      </div>
    </>
  );
}
