import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, BarChart3, ShieldAlert, Camera } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Live Monitor", icon: LayoutDashboard },
    { href: "/history", label: "Event Logs", icon: History },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/screenshots", label: "Screenshots", icon: Camera },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-card/30 flex flex-col backdrop-blur-sm hidden md:flex">
        <div className="p-6 border-b border-border/40 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-wider font-mono">SAFE<span className="text-primary">DRIVER</span></span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(45,212,191,0.15)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isActive ? "animate-pulse" : ""
                  }`}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
