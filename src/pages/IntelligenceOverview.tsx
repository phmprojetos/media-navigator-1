import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain, BarChart3, Target, Palette, Bell, Sparkles, Rocket,
  Lightbulb, ChevronDown, ChevronUp, ExternalLink, Activity,
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, Eye,
  Search, Heart, ShieldAlert, Layers, Radio, CheckCircle2,
  Zap, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import { generateAlerts } from "@/types/alerts";
import { getMomentumMeta } from "@/lib/efficiencyCalculations";
import { inferFunnelStage } from "@/lib/aiCopilotEngine";
import { FUNNEL_STAGE_META, FUNNEL_STAGES } from "@/types/aiCopilot";
import { computeAdoptionImpact } from "@/lib/operationalCalculations";
import { PATTERN_TYPE_META } from "@/types/patternLearning";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { MetricTooltip } from "@/components/intelligence/MetricTooltip";
import { isoClassificationMeta, ISO_COMPONENT_LABELS, formatISOScore } from "@/types/iso";

/* ─── Block wrapper with expand/collapse + contextual help ─── */

interface DiagnosticBlockProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  interpretation: string;
  actionGuide: string;
  deepLink?: string;
  deepLinkLabel?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

function DiagnosticBlock({
  title, icon, description, interpretation, actionGuide,
  deepLink, deepLinkLabel = "Explorar em Profundidade", children, badge,
}: DiagnosticBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Card className="border-border/60 bg-card/90 backdrop-blur">
      <div
        className="flex items-center justify-between p-5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">{icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              {badge}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={e => { e.stopPropagation(); setShowHelp(h => !h); }}
          >
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {showHelp && (
        <div className="mx-5 mb-3 p-4 rounded-lg bg-muted/40 border border-border/40 space-y-2">
          <div className="flex items-start gap-2">
            <Eye className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <span className="text-xs font-medium text-foreground">Como interpretar</span>
              <p className="text-xs text-muted-foreground">{interpretation}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <span className="text-xs font-medium text-foreground">Quando agir</span>
              <p className="text-xs text-muted-foreground">{actionGuide}</p>
            </div>
          </div>
        </div>
      )}

      {expanded && (
        <CardContent className="pt-0 pb-5 px-5 space-y-4">
          {children}
          {deepLink && (
            <Link to={deepLink}>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 mt-2">
                <ExternalLink className="w-3 h-3" />{deepLinkLabel}
              </Button>
            </Link>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Mini KPI Card ─── */

function MiniKPI({ label, value, icon: Icon, color, metricKey }: { label: string; value: string | number; icon: any; color?: string; metricKey?: string }) {
  const labelEl = metricKey ? (
    <MetricTooltip metricKey={metricKey}>
      <p className="text-xs text-muted-foreground">{label}</p>
    </MetricTooltip>
  ) : (
    <p className="text-xs text-muted-foreground">{label}</p>
  );
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
      <div className="p-1.5 rounded-lg bg-muted/60">
        <Icon className={cn("w-4 h-4", color || "text-primary")} />
      </div>
      <div>
        {labelEl}
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function IntelligenceOverview() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();

  const filteredCampaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters, { activeOnly: true }),
    [syncedCampaigns, filters]
  );

  const store = useMemo(() => materializeFeatureStore(filteredCampaigns), [filteredCampaigns]);
  const alerts = useMemo(() => generateAlerts(filteredCampaigns), [filteredCampaigns]);
  const impact = useMemo(() => computeAdoptionImpact(), []);

  const agencyAgg = store.agencyAggregation;
  const momentumMeta = getMomentumMeta(agencyAgg.momentum);
  const recommendations = store.recommendations;
  const iso = store.iso;
  const isoMeta = isoClassificationMeta[iso.classification];
  const aiInsights = store.aiInsights;
  const learnedPatterns = store.learnedPatterns.filter(p => p.pattern_scope === "tenant" && p.active_flag && p.confidence_score >= 50);

  const criticalAlerts = alerts.filter(a => a.severity === "critical" && a.status === "active");
  const highAlerts = alerts.filter(a => a.severity === "high" && a.status === "active");
  const campaignsAtRisk = filteredCampaigns.filter(c => c.currentMBEI < 85);

  const funnelDist = useMemo(() => {
    const dist: Record<string, number> = {};
    filteredCampaigns.forEach(c => { const s = inferFunnelStage(c); dist[s] = (dist[s] || 0) + 1; });
    return dist;
  }, [filteredCampaigns]);

  const highSevRecs = recommendations.filter(r => r.severity === "high" || r.severity === "critical");

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Central de Inteligência</h1>
              <PageInfoTooltip description="Visão unificada de diagnóstico estratégico por cliente. Todos os sinais de inteligência consolidados em uma narrativa única para reduzir sobrecarga cognitiva e acelerar decisões." />
            </div>
            <p className="text-sm text-muted-foreground">
              Diagnóstico estratégico unificado — todos os sinais em uma única narrativa
            </p>
          </div>
        </div>

        {/* Global Filter */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* ═══ ISO — Índice de Saúde da Operação (TOPO) ═══ */}
        <Card className={cn("border-2", isoMeta.border)}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", isoMeta.bg)}>
                  <Activity className={cn("w-6 h-6", isoMeta.color)} />
                </div>
                <div>
                  <MetricTooltip metricKey="iso_score">
                    <h2 className="text-lg font-bold text-foreground">ISO — Índice de Saúde da Operação</h2>
                  </MetricTooltip>
                  <p className="text-xs text-muted-foreground">Consolidação de todos os sinais em uma nota única</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={cn("text-4xl font-bold tabular-nums", isoMeta.color)}>{formatISOScore(iso)}</p>
                  {iso.available && <p className="text-xs text-muted-foreground">/100</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={cn("text-xs border", isoMeta.bg, isoMeta.color, isoMeta.border)}>{iso.classificationLabel}</Badge>
                  {iso.available && (
                    <span className={cn("text-xs font-medium", iso.trend === "up" ? "text-status-success" : iso.trend === "down" ? "text-status-error" : "text-muted-foreground")}>
                      {iso.trend === "up" ? "↑" : iso.trend === "down" ? "↓" : "→"} {iso.trendDelta >= 0 ? "+" : ""}{iso.trendDelta}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 mb-4">
              <div className="flex items-start gap-2">
                <Brain className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground leading-relaxed">{iso.aiSummary}</p>
              </div>
            </div>

            {iso.available && (
              <div className="grid grid-cols-5 gap-3">
                {(Object.entries(iso.components) as [keyof typeof iso.components, number][]).map(([key, value]) => {
                  const comp = ISO_COMPONENT_LABELS[key];
                  const metricKeys: Record<string, string> = {
                    performance: "iso_performance",
                    efficiency: "iso_efficiency",
                    stability: "iso_stability",
                    evolution: "iso_evolution",
                    operational: "iso_operational",
                  };
                  return (
                    <div key={key} className="space-y-1 p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <MetricTooltip metricKey={metricKeys[key]}>
                          <span className="text-[10px] text-muted-foreground">{comp.label}</span>
                        </MetricTooltip>
                        <span className="text-xs font-bold text-foreground">{value}</span>
                      </div>
                      <Progress value={value} className="h-1" />
                      <span className="text-[9px] text-muted-foreground">{comp.weight}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ BLOCO 1: Diagnóstico Executivo ═══ */}
        <DiagnosticBlock
          title="Diagnóstico Executivo"
          icon={<Activity className="w-5 h-5 text-primary" />}
          description="Saúde geral do cliente com KPIs consolidados"
          interpretation="Um ISO acima de 75 indica operação saudável. Abaixo de 60 exige ação imediata. A tendência mostra a evolução dos últimos 7 dias."
          actionGuide="Quando o ISO cair abaixo de 75 ou a tendência ficar negativa por 3+ dias, revise as campanhas em risco e alertas críticos."
          deepLink="/daily-brief"
          deepLinkLabel="Ver Briefing Completo"
          badge={<Badge variant="outline" className={cn("text-xs", momentumMeta.color)}>{momentumMeta.arrow} {momentumMeta.label}</Badge>}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKPI label="ISO" value={formatISOScore(iso)} icon={Activity} color={isoMeta.color} metricKey="iso_score" />
            <MiniKPI label="Campanhas Ativas" value={filteredCampaigns.length} icon={Target} metricKey="active_campaigns" />
            <MiniKPI label="Em Risco" value={campaignsAtRisk.length} icon={ShieldAlert} color="text-status-error" metricKey="at_risk_campaigns" />
            <MiniKPI label="Alertas Críticos" value={criticalAlerts.length} icon={AlertTriangle} color={criticalAlerts.length > 0 ? "text-status-error" : "text-status-success"} metricKey="critical_alerts" />
          </div>
        </DiagnosticBlock>

        {/* ═══ BLOCO 2: Funil e Jornada ═══ */}
        <DiagnosticBlock
          title="Funil e Jornada"
          icon={<Layers className="w-5 h-5 text-primary" />}
          description="Distribuição de campanhas por estágio do funil de conversão"
          interpretation="O equilíbrio ideal entre estágios depende da estratégia. Excesso de awareness sem conversion pode indicar desbalanceamento. O lift signal mede a correlação entre estágios."
          actionGuide="Se mais de 60% do investimento está em um único estágio sem resultados proporcionais, redistribua. Se lift signal < 40, investigue gaps entre funil."
          deepLink="/ai-insights"
          deepLinkLabel="Ver Análise de Funil Completa"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FUNNEL_STAGES.map(stage => {
              const meta = FUNNEL_STAGE_META[stage];
              const icons: Record<string, any> = { awareness: Eye, consideration: Search, conversion: Target, retention: Heart };
              const Icon = icons[stage];
              return (
                <div key={stage} className="p-3 rounded-lg bg-muted/40 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                    <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{funnelDist[stage] || 0}</p>
                  <p className="text-xs text-muted-foreground">campanhas</p>
                </div>
              );
            })}
          </div>

          {store.funnelInteractions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {store.funnelInteractions.slice(0, 4).map(fi => (
                <div key={fi.clientId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium text-foreground">{fi.clientName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Lift Signal:</span>
                    <span className={cn("text-sm font-bold", fi.liftSignalScore >= 60 ? "text-status-success" : fi.liftSignalScore >= 40 ? "text-status-warning" : "text-status-error")}>{fi.liftSignalScore}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiagnosticBlock>

        {/* ═══ BLOCO 3: Estrutura de Performance ═══ */}
        <DiagnosticBlock
          title="Estrutura de Performance"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          description="Elasticidade, saturação e modelos estatísticos de eficiência"
          interpretation="Elasticidade > 1 = campanhas escaláveis. Saturação alta = frequência excessiva reduzindo conversão. O perfil de cada cliente ajuda a priorizar estratégias."
          actionGuide="Escale campanhas com alta elasticidade. Reduza frequência em campanhas com saturação alta. Reavalie o mix de canais quando a sensibilidade de margem for alta."
          deepLink="/statistical-intelligence"
          deepLinkLabel="Ver Modelos Estatísticos"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKPI
              label="Elasticidade Média"
              value={store.elasticityAnalyses.length > 0 ? (store.elasticityAnalyses.reduce((s, e) => s + e.elasticityScore, 0) / store.elasticityAnalyses.length).toFixed(2) : "—"}
              icon={TrendingUp}
              metricKey="elasticity_avg"
            />
            <MiniKPI
              label="Risco Saturação"
              value={store.saturationAnalyses.filter(s => s.saturationRiskLevel === "high" || s.saturationRiskLevel === "critical").length}
              icon={Radio}
              color="text-status-warning"
              metricKey="saturation_risk"
            />
            <MiniKPI
              label="Sensib. Margem"
              value={store.marginSensitivities.length > 0 ? (store.marginSensitivities.reduce((s, m) => s + m.marginSensitivityScore, 0) / store.marginSensitivities.length).toFixed(2) : "—"}
              icon={DollarSign}
              color="text-emerald-500"
              metricKey="margin_sensitivity"
            />
            <MiniKPI
              label="Camps. Escaláveis"
              value={store.elasticityAnalyses.filter(e => e.classification === "high").length}
              icon={Rocket}
              color="text-status-success"
              metricKey="scalable_campaigns"
            />
          </div>

          {store.clientClusters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {store.clientClusters.slice(0, 4).map(cl => (
                <div key={cl.clientId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium text-foreground">{cl.clientName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Efic. {cl.avgMBEI}</Badge>
                    <Badge variant="outline" className="text-[10px]">Elast. {cl.elasticityAvg}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiagnosticBlock>

        {/* ═══ BLOCO 4: Criativos ═══ */}
        <DiagnosticBlock
          title="Criativos"
          icon={<Palette className="w-5 h-5 text-primary" />}
          description="Inteligência de performance criativa e padrões visuais"
          interpretation="Identifique quais formatos, durações e mensagens geram melhor conversão. Criativos com fadiga (queda de CTR ao longo do tempo) devem ser rotacionados."
          actionGuide="Rotacione criativos quando o CTR cair mais de 20% da média. Priorize formatos com melhor custo por conversão. Teste novos conceitos baseados nos padrões detectados."
          deepLink="/creative-intelligence"
          deepLinkLabel="Ver Inteligência Criativa"
        >
          {(() => {
            const creativeRecs = recommendations.filter(r => r.type === "creative_rotation");
            const creativePatterns = learnedPatterns.filter(p => p.pattern_type === "creative");
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MiniKPI label="Rotações Sugeridas" value={creativeRecs.length} icon={Palette} metricKey="creative_rotations" />
                  <MiniKPI label="Padrões Criativos" value={creativePatterns.length} icon={Sparkles} metricKey="creative_patterns" />
                </div>
                {creativeRecs.length > 0 && (
                  <div className="space-y-2">
                    {creativeRecs.slice(0, 3).map(r => (
                      <div key={r.id} className="p-3 rounded-lg bg-muted/30 text-sm">
                        <p className="font-medium text-foreground">{r.campaignName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.suggestedAction}</p>
                      </div>
                    ))}
                  </div>
                )}
                {creativeRecs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma rotação criativa necessária no momento.</p>
                )}
              </div>
            );
          })()}
        </DiagnosticBlock>

        {/* ═══ BLOCO 5: Alertas ═══ */}
        <DiagnosticBlock
          title="Alertas"
          icon={<Bell className="w-5 h-5 text-primary" />}
          description="Monitoramento proativo de anomalias e riscos de performance"
          interpretation="Alertas críticos indicam risco imediato de perda de eficiência ou orçamento. Alertas altos precisam de atenção dentro de 24h. Médios são informativos."
          actionGuide="Resolva alertas críticos imediatamente. Para alertas de pacing, ajuste orçamentos. Para drops de eficiência, investigue mudanças recentes nas campanhas."
          deepLink="/alerts"
          deepLinkLabel="Ver Todos os Alertas"
          badge={
            criticalAlerts.length > 0 ? (
              <Badge className="bg-status-error/10 text-status-error border-status-error/20 text-xs">{criticalAlerts.length} críticos</Badge>
            ) : <Badge className="bg-status-success/10 text-status-success text-xs">Tudo certo</Badge>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKPI label="Críticos" value={criticalAlerts.length} icon={AlertTriangle} color="text-status-error" metricKey="critical_alerts" />
            <MiniKPI label="Altos" value={highAlerts.length} icon={ShieldAlert} color="text-status-warning" metricKey="high_alerts" />
            <MiniKPI label="Total Ativos" value={alerts.filter(a => a.status === "active").length} icon={Bell} metricKey="total_active_alerts" />
            <MiniKPI label="Resolvidos" value={alerts.filter(a => a.status === "resolved").length} icon={CheckCircle2} color="text-status-success" metricKey="resolved_alerts" />
          </div>

          {criticalAlerts.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atenção Imediata</span>
              {criticalAlerts.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-status-error/5 border border-status-error/10">
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.campaignName}</p>
                    <p className="text-xs text-muted-foreground">{a.trigger_reason}</p>
                  </div>
                  <Badge className="bg-status-error/10 text-status-error text-xs">{a.platform}</Badge>
                </div>
              ))}
            </div>
          )}
        </DiagnosticBlock>

        {/* ═══ BLOCO 6: Padrões Detectados ═══ */}
        <DiagnosticBlock
          title="Padrões Detectados"
          icon={<Sparkles className="w-5 h-5 text-primary" />}
          description="Motor de aprendizado que identifica comportamentos recorrentes de performance"
          interpretation="Padrões com confiança acima de 75% são altamente confiáveis. O impacto indica o potencial de melhoria. Padrões experimentais ainda estão em validação."
          actionGuide="Utilize padrões de alto impacto e alta confiança para ajustar estratégias. Padrões de risco devem acionar ações preventivas."
          deepLink="/pattern-intelligence"
          deepLinkLabel="Ver Todos os Padrões"
          badge={<Badge variant="outline" className="text-xs">{learnedPatterns.length} ativos</Badge>}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MiniKPI label="Alto Impacto" value={learnedPatterns.filter(p => p.impact_level === "high").length} icon={TrendingUp} color="text-status-success" metricKey="high_impact_patterns" />
            <MiniKPI label="Experimentais" value={learnedPatterns.filter(p => p.experimental_flag).length} icon={Zap} color="text-status-warning" metricKey="experimental_patterns" />
            <MiniKPI
              label="Confiança Média"
              value={learnedPatterns.length > 0 ? `${Math.round(learnedPatterns.reduce((s, p) => s + p.confidence_score, 0) / learnedPatterns.length)}%` : "—"}
              icon={Target}
              metricKey="avg_confidence"
            />
          </div>

          {learnedPatterns.filter(p => p.impact_level === "high").slice(0, 3).map(p => {
            const meta = PATTERN_TYPE_META[p.pattern_type];
            return (
              <div key={p.pattern_id} className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn("text-[10px]", meta.color)}>{meta.label}</Badge>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400">alto impacto</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{p.confidence_score}% confiança</span>
                </div>
                <p className="text-sm text-foreground">{p.pattern_description}</p>
              </div>
            );
          })}
        </DiagnosticBlock>

        {/* ═══ BLOCO 7: Impacto Estrutural ═══ */}
        <DiagnosticBlock
          title="Impacto Estrutural"
          icon={<Rocket className="w-5 h-5 text-primary" />}
          description="Métricas acumuladas de impacto desde a adoção da plataforma"
          interpretation="A economia total reflete ganhos reais de eficiência. A melhoria de margem mostra o impacto financeiro. A taxa de resolução indica maturidade operacional."
          actionGuide="Use estes dados em reuniões executivas para demonstrar ROI. Se a taxa de resolução de alertas cair abaixo de 70%, revise processos internos."
          deepLink="/impact"
          deepLinkLabel="Ver Histórico de Impacto"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKPI label="Economia Total" value={`R$ ${impact.totalSavings.toLocaleString("pt-BR")}`} icon={DollarSign} color="text-status-success" metricKey="total_savings" />
            <MiniKPI label="Redução CPA" value={`${impact.cpaReduction}%`} icon={TrendingDown} color="text-status-success" metricKey="cpa_reduction" />
            <MiniKPI label="Alertas Resolvidos" value={`${impact.alertResolutionRate}%`} icon={CheckCircle2} metricKey="alert_resolution_rate" />
            <MiniKPI label="Melhoria Margem" value={`+${impact.marginImprovement}pp`} icon={TrendingUp} color="text-status-success" metricKey="margin_improvement" />
          </div>
        </DiagnosticBlock>

        {/* ═══ BLOCO 8: Recomendações da IA ═══ */}
        <DiagnosticBlock
          title="Recomendações da IA"
          icon={<Lightbulb className="w-5 h-5 text-primary" />}
          description="Sugestões automáticas de otimização baseadas nos sinais da plataforma"
          interpretation="Recomendações críticas têm potencial de impacto imediato. A confiança da IA indica a robustez da análise. O impacto estimado mostra o ganho potencial."
          actionGuide="Priorize recomendações de alta severidade. Aplique-as diretamente ou use como base para discussão com o time. Descarte apenas com justificativa."
          deepLink="/optimization-center"
          deepLinkLabel="Ver Central de Otimização"
          badge={highSevRecs.length > 0 ? <Badge className="bg-status-warning/10 text-status-warning text-xs">{highSevRecs.length} urgentes</Badge> : undefined}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MiniKPI label="Recomendações Ativas" value={recommendations.length} icon={Lightbulb} metricKey="active_recommendations" />
            <MiniKPI label="Alta Prioridade" value={highSevRecs.length} icon={ShieldAlert} color="text-status-error" metricKey="high_priority_recs" />
            <MiniKPI
              label="Impacto Estimado"
              value={`R$ ${recommendations.reduce((s, r) => s + (r.estimatedImpact || 0), 0).toLocaleString("pt-BR")}`}
              icon={DollarSign}
              color="text-status-success"
              metricKey="estimated_impact"
            />
          </div>

          {aiInsights.slice(0, 3).map(insight => (
            <div key={insight.id} className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-start gap-2">
                <Brain className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground leading-relaxed">{insight.generatedText}</p>
                  <span className="text-xs text-muted-foreground">Confiança: {insight.confidenceScore}%</span>
                </div>
              </div>
            </div>
          ))}

          {highSevRecs.slice(0, 3).map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{r.campaignName}</p>
                <p className="text-xs text-muted-foreground">{r.suggestedAction}</p>
              </div>
              <Badge variant="outline" className="text-xs ml-2">{r.impactLabel}</Badge>
            </div>
          ))}
        </DiagnosticBlock>
      </div>
    </AppLayout>
  );
}
