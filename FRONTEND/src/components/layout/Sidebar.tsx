import {
  BarChart3,
  Zap,
  LineChart,
  Settings,
  FileText,
  UserRound,
  WalletCards,
} from "lucide-react";

type Props = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export default function Sidebar({ activeTab, setActiveTab }: Props) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "strategies", label: "Strategies", icon: Zap },
    { id: "analytics", label: "Analytics", icon: LineChart },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "accounts", label: "Accounts", icon: WalletCards },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col">
        <nav className="flex-1 p-4 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Original Mobile Navigation */}
      <div className="md:hidden w-full border-b border-border bg-card">
        <nav className="flex overflow-x-auto gap-2 p-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => setActiveTab("accounts")}
            aria-label="Open broker accounts"
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              activeTab === "accounts"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <WalletCards className="h-4 w-4" />
            Accounts
          </button>
          <button
            onClick={() => setActiveTab("account")}
            aria-label="Open account page"
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              activeTab === "account"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <UserRound className="h-4 w-4" />
            Account
          </button>
        </nav>
      </div>
    </>
  );
}
