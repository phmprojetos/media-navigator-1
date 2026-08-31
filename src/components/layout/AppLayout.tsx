import { useState, useEffect, useLayoutEffect, useRef, memo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRBAC } from "@/contexts/RBACContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Tags, Link2, CheckSquare, Calculator, Image,
  ShieldCheck, BarChart3, Settings, ChevronLeft, Menu, Zap,
  DollarSign, Gauge, FileText, Clock, TrendingUp, Lightbulb, BookOpen,
  FlaskConical, Shield, Trophy, MessageSquare, ClipboardList, Users,
  Truck, Crown, Building, Bell, PiggyBank, CreditCard, Palette, Plug,
  Sun, Calendar, Rocket, Brain, Activity, ServerCog, Sparkles, Layers, UserPlus,
  LogOut, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ClientSwitcher } from "@/components/layout/ClientSwitcher";
import { type LucideIcon } from "lucide-react";
import { useAgency } from "@/hooks/useAgency";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  moduleKey: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, moduleKey: "dashboard" },
      { name: "Planejamento", href: "/planning", icon: Calculator, moduleKey: "planning" },
      { name: "Taxonomia", href: "/taxonomy", icon: Tags, moduleKey: "taxonomy" },
      { name: "URLs & UTMs", href: "/urls", icon: Link2, moduleKey: "urls" },
      { name: "Checklists", href: "/checklists", icon: CheckSquare, moduleKey: "checklists" },
      { name: "Criativos", href: "/creatives", icon: Image, moduleKey: "creatives" },
      { name: "Canais e Formatos", href: "/channels-formats", icon: Plug, moduleKey: "channels-formats" },
      { name: "LeadSync", href: "/lead-gen", icon: UserPlus, moduleKey: "lead-gen" },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { name: "Visão Geral", href: "/intelligence", icon: Brain, moduleKey: "intelligence-overview" },
      { name: "Pattern Intelligence", href: "/pattern-intelligence", icon: Activity, moduleKey: "pattern-intelligence" },
      { name: "Eficiência", href: "/efficiency", icon: BarChart3, moduleKey: "efficiency" },
      { name: "Auditoria", href: "/audit", icon: ShieldCheck, moduleKey: "audit" },
      { name: "Intel. Criativos", href: "/creative-intelligence", icon: Lightbulb, moduleKey: "creative-intelligence" },
      { name: "Base de Conhecimento", href: "/knowledge", icon: BookOpen, moduleKey: "knowledge" },
      { name: "Simulação", href: "/simulation", icon: FlaskConical, moduleKey: "simulation" },
      { name: "Maturidade do Cliente", href: "/maturity", icon: Gauge, moduleKey: "maturity" },
      { name: "Central de Alertas", href: "/alerts", icon: Bell, moduleKey: "alerts" },
      { name: "Benchmark", href: "/benchmark", icon: BarChart3, moduleKey: "benchmark" },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { name: "Controle de PI's", href: "/insertion-orders", icon: ClipboardList, moduleKey: "insertion-orders" },
      { name: "Clientes", href: "/clients", icon: Users, moduleKey: "clients" },
      { name: "Fornecedores", href: "/suppliers", icon: Truck, moduleKey: "suppliers" },
      { name: "Rentabilidade", href: "/profitability", icon: DollarSign, moduleKey: "profitability" },
      { name: "Financeiro Agência", href: "/financial-overview", icon: PiggyBank, moduleKey: "financial-overview" },
    ],
  },
  {
    label: "ESTRATÉGIA",
    items: [
      { name: "Painel Executivo", href: "/executive-dashboard", icon: Crown, moduleKey: "executive-dashboard" },
      { name: "Índice da Agência", href: "/agency-index", icon: Building, moduleKey: "agency-index" },
      { name: "Narrativa", href: "/narrative", icon: MessageSquare, moduleKey: "narrative" },
      { name: "Resumo Executivo", href: "/monthly-executive", icon: FileText, moduleKey: "monthly-executive" },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { name: "Propostas", href: "/proposals", icon: FileText, moduleKey: "proposals" },
      { name: "SLA & Operação", href: "/sla", icon: Clock, moduleKey: "sla" },
      { name: "Comercial", href: "/sales", icon: TrendingUp, moduleKey: "sales" },
      { name: "Governança", href: "/governance", icon: Shield, moduleKey: "governance" },
      { name: "Incentivos", href: "/incentives", icon: Trophy, moduleKey: "incentives" },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { name: "Dados & Integrações", href: "/data-integrations", icon: Layers, moduleKey: "data-integrations" },
      { name: "Assinatura & Uso", href: "/subscription", icon: CreditCard, moduleKey: "subscription" },
      { name: "Config. Agência", href: "/agency-settings", icon: Palette, moduleKey: "agency-settings" },
    ],
  },
  {
    label: "PLATFORM",
    items: [
      { name: "Agências", href: "/ops/agencies", icon: Building2, moduleKey: "ops-agencies" },
      { name: "Console da Plataforma", href: "/platform-console", icon: ServerCog, moduleKey: "platform-console" },
      { name: "Arquitetura", href: "/architecture", icon: Layers, moduleKey: "architecture" },
    ],
  },
];

// Module-level scroll position — survives React re-renders
let _sidebarScrollTop = 0;

/* ─── Sidebar (isolated from route changes) ─── */
const Sidebar = memo(function Sidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const { canAccess } = useRBAC();
  const { user, signOut } = useAuth();
  const { isPlatformOps } = useAgency();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);
  const pathname = location.pathname;
  const navRef = useRef<HTMLElement>(null);

  // Restore scroll position synchronously after every render
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (nav) {
      nav.scrollTop = _sidebarScrollTop;
    }
  });

  // Track scroll changes
  const handleNavScroll = useCallback(() => {
    if (navRef.current) {
      _sidebarScrollTop = navRef.current.scrollTop;
    }
  }, []);

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canAccess(item.moduleKey)) return false;
        if (item.moduleKey === "ops-agencies" && !isPlatformOps) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out flex-shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 transition-all duration-300">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-foreground tracking-tight">
              MediaHub
            </span>
          )}
        </div>
      </div>

      {/* Navigation — this is the scrollable area */}
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {visibleGroups.map((group, groupIdx) => (
          <div key={group.label}>
            {groupIdx > 0 && (
              <>
                {!collapsed && (
                  <div className="pt-4 pb-2">
                    <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </span>
                  </div>
                )}
                {collapsed && <div className="my-2 border-t border-sidebar-border" />}
              </>
            )}
            {groupIdx === 0 && !collapsed && (
              <div className="pb-2">
                <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
            )}

            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
                    isActive
                      ? "bg-primary/15 text-primary shadow-sm border border-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                  )}
                  <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Theme Toggle & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-2 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-muted-foreground hover:text-foreground transition-all duration-200"
          onClick={onToggleCollapse}
        >
          {collapsed ? (
            <Menu className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span>Recolher</span>
            </>
          )}
        </Button>
      </div>

      {/* Settings + Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-1 flex-shrink-0">
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
            pathname === "/settings"
              ? "bg-primary/15 text-primary shadow-sm border border-primary/20"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
          )}
        >
          {pathname === "/settings" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
          )}
          <Settings className={cn("w-5 h-5 flex-shrink-0", pathname === "/settings" && "text-primary")} />
          {!collapsed && <span>Configurações</span>}
        </Link>

        {!collapsed && user?.email && (
          <div className="px-3 py-1.5">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-200 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
});

/* ─── Main Content (scroll resets on route change) ─── */
function MainContent({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const location = useLocation();

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <main ref={ref} className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-20 flex items-center justify-end gap-3 px-6 py-3 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <span className="text-xs text-muted-foreground hidden sm:inline">Cliente</span>
        <ClientSwitcher />
      </div>
      <div className="animate-fade-in">
        {children}
      </div>
    </main>
  );
}

/* ─── Layout Shell ─── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapse = useCallback(() => setCollapsed(c => !c), []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <MainContent>{children}</MainContent>
    </div>
  );
}
