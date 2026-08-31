import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCircle2, AlertTriangle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { generateAlerts, getSeverityMeta, getAlertTypeLabel, type AlertLog, type AlertSeverity, type AlertStatus } from "@/types/alerts";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

export default function AlertsCenter() {
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const generated = useMemo(() => generateAlerts(syncedCampaigns), [syncedCampaigns]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  useEffect(() => {
    setAlerts(generated);
  }, [generated]);
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Map campaign_id to client info
  const campaignClientMap = useMemo(() => {
    const map: Record<string, { clientId: string; clientName: string }> = {};
    syncedCampaigns.forEach(c => { map[c.campaignId] = { clientId: c.clientId, clientName: c.clientName }; });
    return map;
  }, [syncedCampaigns]);

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      const client = campaignClientMap[a.campaign_id];
      if (filters.clientId !== "all" && client?.clientId !== filters.clientId) return false;
      if (filters.platform !== "all" && a.platform !== filters.platform) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (alertStatusFilter !== "all" && a.status !== alertStatusFilter) return false;
      if (typeFilter !== "all" && a.alert_type !== typeFilter) return false;
      return true;
    });
  }, [alerts, filters, severityFilter, alertStatusFilter, typeFilter, campaignClientMap]);

  const resolve = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "resolved" as AlertStatus, resolved_at: new Date().toISOString() } : a));
  };

  const activeCount = alerts.filter(a => a.status === "active").length;
  const criticalCount = alerts.filter(a => a.status === "active" && a.severity === "critical").length;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Central de Alertas</h1>
              <PageInfoTooltip description="Monitore alertas automáticos de performance, anomalias e riscos com filtros por severidade, tipo e status." />
              <Badge className="bg-status-error/10 text-status-error border-status-error/20">{activeCount} ativos</Badge>
              {criticalCount > 0 && <Badge className="bg-status-error text-background">{criticalCount} críticos</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">Central de alertas proativos multi-cliente</p>
          </div>
        </div>

        {/* Global Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} showStatus={false} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Alert-specific filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={alertStatusFilter} onValueChange={setAlertStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status Alerta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="efficiency">MBEI Drop</SelectItem>
              <SelectItem value="cpa">CPA Overrun</SelectItem>
              <SelectItem value="pacing">Spend Pacing</SelectItem>
              <SelectItem value="conversion">Conversion Drop</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alert Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Campanha</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">DSP</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Severidade</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Motivo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Ação Sugerida</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-right p-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhum alerta encontrado</td></tr>
                )}
                {filtered.map((alert) => {
                  const sev = getSeverityMeta(alert.severity);
                  const client = campaignClientMap[alert.campaign_id];
                  return (
                    <tr key={alert.id} className={cn("border-b border-border last:border-0 transition-colors", alert.status === "resolved" && "opacity-60")}>
                      <td className="p-3 font-medium text-foreground">{client?.clientName || "—"}</td>
                      <td className="p-3">
                        <p className="font-medium text-foreground">{alert.campaignName}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">{alert.platform}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{getAlertTypeLabel(alert.alert_type)}</Badge></td>
                      <td className="p-3"><span className={cn("text-xs font-semibold px-2 py-1 rounded-full", sev.bg, sev.color)}>{sev.label}</span></td>
                      <td className="p-3 text-muted-foreground max-w-[180px]">{alert.trigger_reason}</td>
                      <td className="p-3 text-muted-foreground max-w-[180px]">{alert.suggested_action}</td>
                      <td className="p-3">
                        {alert.status === "active" ? (
                          <span className="flex items-center gap-1 text-status-warning"><AlertTriangle className="w-3 h-3" /> Ativo</span>
                        ) : (
                          <span className="flex items-center gap-1 text-status-success"><CheckCircle2 className="w-3 h-3" /> Resolvido</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(alert.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-right">
                        {alert.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => resolve(alert.id)}>Resolver</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
