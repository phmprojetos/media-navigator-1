import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity, TrendingUp, TrendingDown, Zap, Target,
  BarChart3, Layers, Calculator, Info, ShieldCheck, Clock,
  DollarSign, ArrowUpRight, BookOpen, Lightbulb, Eye,
  ChevronRight, Sparkles, GraduationCap, CheckCircle2, RefreshCw, Tag,
} from "lucide-react";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, Legend, ComposedChart,
} from "recharts";
import {
  runFunnelImpactAnalysis, runSimulation,
} from "@/lib/funnelImpactEngine";
import type { TPIWeights, SimulationInput } from "@/types/funnelImpact";
import { useClient, displayClientName } from "@/contexts/ClientContext";
import { useClientPatternFunnel } from "@/hooks/useClientPatternFunnel";
import type { ClassifiedCampaignSummary } from "@/lib/funnelRole";

type AttributionSummary = {
  conv1dClick: number;
  conv7dClick: number;
  conv1dView: number;
  conv7dView: number;
  viewThroughPct: number;
  cycleLengthRatio: number;
} | null;

// ── Confidence badge helpers ──
const confidenceMeta = {
  alta: { label: "Alta Confiança", color: "text-emerald-500", bg: "bg-emerald-500/15 border-emerald-500/30", icon: ShieldCheck },
  media: { label: "Média Confiança", color: "text-amber-500", bg: "bg-amber-500/15 border-amber-500/30", icon: Info },
  baixa: { label: "Dados Limitados", color: "text-muted-foreground", bg: "bg-muted/40 border-border", icon: Info },
};

const sensitivityMeta = {
  alta: { label: "Alta Sensibilidade", color: "text-emerald-500", bg: "bg-emerald-500/15" },
  media: { label: "Média Sensibilidade", color: "text-amber-500", bg: "bg-amber-500/15" },
  baixa: { label: "Baixa Sensibilidade", color: "text-red-500", bg: "bg-red-500/15" },
};

// ── Tooltip definitions (no formulas, no coefficients) ──
const TOOLTIPS: Record<string, { title: string; text: string }> = {
  incrementoEstimado: {
    title: "Conversões Incrementais",
    text: "Estimativa do impacto adicional gerado pelas campanhas de topo sobre as conversões de venda (evento purchase) do fundo de funil, considerando defasagem temporal e efeito acumulado. Leads e outros eventos não entram neste indicador.",
  },
  reducaoCPA: {
    title: "Redução de CPA",
    text: "Redução estimada no custo por aquisição proporcionada pela contribuição das campanhas de topo de funil, que ampliam a base de consideração e facilitam a conversão.",
  },
  impactoROAS: {
    title: "Impacto no ROAS",
    text: "Ganho percentual no retorno sobre investimento em mídia atribuído ao efeito estrutural das campanhas de awareness sobre a eficiência do fundo de funil.",
  },
  receitaIncremental: {
    title: "Receita Incremental",
    text: "Valor estimado de receita adicional gerada pelo efeito do topo de funil que não existiria sem a presença dessas campanhas.",
  },
  janelaOtima: {
    title: "Janela de Impacto",
    text: "Período médio em dias que o investimento em topo de funil leva para influenciar os resultados de fundo. Quanto menor, mais rápido o ciclo de impacto.",
  },
  ajusteModelo: {
    title: "Precisão do Modelo",
    text: "Indicador que mede o quanto o modelo consegue explicar a variação observada nos resultados. Quanto maior, mais confiável é a análise.",
  },
  decaimento: {
    title: "Efeito Acumulado",
    text: "Mede o quanto o impacto das campanhas de topo persiste ao longo do tempo. Um valor mais alto indica que o efeito se acumula por mais dias antes de se dissipar.",
  },
  elasticidade: {
    title: "Elasticidade Topo → Fundo",
    text: "Indicador de sensibilidade que mostra quanto os resultados de fundo variam proporcionalmente ao aumento da pressão de topo.",
  },
  confianca: {
    title: "Nível de Confiança",
    text: "Indicador estatístico que mede a robustez do modelo com base na variação histórica, estabilidade e consistência dos dados.",
  },
  tpiPesos: {
    title: "Índice de Pressão de Topo (TPI)",
    text: "Índice composto que quantifica a intensidade da ação de topo de funil, combinando alcance, frequência e investimento em uma métrica única.",
  },
  atribuicaoBlock: {
    title: "Atribuição por Janela",
    text: "Mostra como as conversões se distribuem entre janelas de tempo (1 dia vs 7 dias) e tipo (clique vs visualização). O view-through revela conversões geradas por quem apenas viu o anúncio de topo — sem clicar.",
  },
  mapaTemporalBlock: {
    title: "Mapa Temporal",
    text: "Visualização que sobrepõe a evolução do índice de pressão de topo com as conversões de fundo, permitindo identificar visualmente as correlações temporais.",
  },
  saturacaoBlock: {
    title: "Curva de Saturação",
    text: "Mostra o ponto a partir do qual aumentos adicionais em topo de funil geram retornos cada vez menores, ajudando a definir o investimento ideal.",
  },
  simuladorBlock: {
    title: "Simulador Estratégico",
    text: "Permite testar cenários estratégicos antes de alocar orçamento adicional, ajudando na tomada de decisão orientada por dados.",
  },
  resumoExecBlock: {
    title: "Resumo Executivo",
    text: "Consolidação dos principais indicadores de impacto incremental do topo de funil, com interpretação automática gerada pelo motor de análise.",
  },
};

// ── Walkthrough steps ──
const WALKTHROUGH_STEPS = [
  { title: "Impacto do Topo no Fundo", description: "Veja como as campanhas de awareness influenciam diretamente as conversões e receita de fundo de funil.", icon: Target },
  { title: "Janela de Impacto", description: "Identifique em quantos dias o investimento em topo começa a gerar retorno no fundo.", icon: Clock },
  { title: "Retorno Marginal", description: "Entenda até que ponto aumentar topo gera ganhos, e onde começa a saturação.", icon: TrendingUp },
  { title: "Simule Cenários", description: "Projete resultados antes de investir — teste aumentos de +5%, +10% ou +20% e veja o impacto estimado.", icon: Calculator },
];

const WALKTHROUGH_KEY = "pi_walkthrough_completed";

export default function PatternIntelligence() {
  const { selectedClientId, selectedClient } = useClient();
  const clientFunnel = useClientPatternFunnel(selectedClientId);

  const [tpiWeights, setTpiWeights] = useState<TPIWeights>({ alcance: 0.4, frequencia: 0.3, investimento: 0.3 });
  const [simType, setSimType] = useState<"percent" | "absolute">("percent");
  const [simValue, setSimValue] = useState<number>(10);
  const [ticketMedio, setTicketMedio] = useState<number>(0);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const realData = clientFunnel.series;
  const dataLoading = clientFunnel.loading;
  const isClickProxy = clientFunnel.isClickProxy;
  const lastSync = clientFunnel.lastSync;
  const campaigns = clientFunnel.campaigns;
  const attributionSummary = clientFunnel.attributionSummary as AttributionSummary;
  const clickEfficiency = clientFunnel.clickEfficiency;
  const hasClient = !!selectedClientId;
  const clientLabel = selectedClient ? displayClientName(selectedClient) : null;

  const funnelData = useMemo(() => realData ?? [], [realData]);
  const hasFundoData = funnelData.some(d => d.conversoesFundo > 0 || d.receitaFundo > 0);

  const dataPeriod = funnelData.length > 0 ? {
    start: funnelData[0].date.slice(0, 10),
    end: funnelData[funnelData.length - 1].date.slice(0, 10),
    days: funnelData.length,
  } : null;

  // Walkthrough first-access
  useEffect(() => {
    if (!localStorage.getItem(WALKTHROUGH_KEY)) {
      setWalkthroughOpen(true);
    }
  }, []);

  const analysis = useMemo(() => {
    if (funnelData.length === 0) return null;
    return runFunnelImpactAnalysis(funnelData, tpiWeights);
  }, [funnelData, tpiWeights]);

  // Tendência: compara primeira metade vs segunda metade do período
  const periodTrend = useMemo(() => {
    if (!analysis || funnelData.length < 14) return null;
    const mid = Math.floor(funnelData.length / 2);
    const prev = funnelData.slice(0, mid);
    const curr = funnelData.slice(mid);
    const prevAnalysis = runFunnelImpactAnalysis(prev, tpiWeights);
    const currAnalysis = runFunnelImpactAnalysis(curr, tpiWeights);
    const delta = (curr: number, prev: number) => prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100;
    return {
      conversoes: delta(currAnalysis.incrementalImpact.incrementalConversions, prevAnalysis.incrementalImpact.incrementalConversions),
      elasticidade: delta(currAnalysis.elasticity.elasticity, prevAnalysis.elasticity.elasticity),
      janela: delta(currAnalysis.bestLagModel.lagDays, prevAnalysis.bestLagModel.lagDays),
    };
  }, [funnelData, tpiWeights, analysis]);

  const simulation = useMemo(() => {
    if (!analysis) return null;
    const input: SimulationInput = { increaseType: simType, value: simValue };
    return runSimulation(input, funnelData, analysis.bestAdstock.beta1, analysis.tpiSeries);
  }, [simType, simValue, funnelData, analysis]);

  const emptyReason = !hasClient
    ? "Selecione um cliente no seletor do topo para analisar o funil consolidado (todas as plataformas)."
    : clientFunnel.error || "Sem dados de funil sincronizados para este cliente.";

  if (!analysis || !simulation) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Pattern Intelligence</h1>
                <p className="text-sm text-muted-foreground">
                  Diagnóstico estrutural de funil por cliente · multiplataforma
                </p>
              </div>
            </div>
            {clientLabel && (
              <Badge variant="outline" className="text-xs">
                {clientLabel}
                {clientFunnel.linkedAccounts.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground">
                    · {clientFunnel.linkedAccounts.length} conta{clientFunnel.linkedAccounts.length > 1 ? "s" : ""}
                  </span>
                )}
              </Badge>
            )}
          </div>
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-2">
              {dataLoading ? (
                <>
                  <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground animate-spin" />
                  <h3 className="font-semibold text-foreground">Carregando funil do cliente…</h3>
                </>
              ) : (
                <>
                  <Activity className="w-8 h-8 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Sem dados para análise</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {emptyReason}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { bestLagModel, bestAdstock, tpiSeries, incrementalImpact, saturationCurve, elasticity, confidence, executiveSummary } = analysis;

  const confMeta = confidenceMeta[confidence.level];
  const ConfIcon = confMeta.icon;

  const temporalData = funnelData.map((d, i) => ({
    date: d.date.slice(5),
    tpiAdstock: tpiSeries[i]?.tpiAdstock ?? 0,
    conversoes: d.conversoesFundo,
  }));

  const satData = saturationCurve.map(p => ({
    tpi: +p.tpiAdstock.toFixed(2),
    conversoes: p.modeledConversions,
    retornoMarginal: +(p.marginalReturn * 100).toFixed(1),
  }));

  // ── Auto-insights ──
  const elasticityInsight = elasticity.sensitivity === "alta"
    ? "A performance de fundo demonstra alta sensibilidade à pressão de topo. Incrementos adicionais podem gerar ganhos relevantes."
    : elasticity.sensitivity === "media"
      ? "A sensibilidade entre topo e fundo é moderada. Há espaço para ganhos, mas com retornos decrescentes."
      : "A sensibilidade atual é baixa. Outros fatores podem estar influenciando mais os resultados de fundo.";

  const lastSat = saturationCurve[saturationCurve.length - 1];
  const saturationInsight = lastSat && lastSat.marginalReturn < 0.5
    ? "O modelo indica proximidade de saturação. Aumentos adicionais podem gerar retorno marginal reduzido."
    : "Ainda há espaço para crescimento antes de atingir o ponto de saturação.";

  const confidenceInsight = confidence.level === "alta"
    ? "Os dados apresentam alta consistência e estabilidade, sustentando as estimativas com robustez."
    : confidence.level === "media"
      ? "A consistência dos dados é moderada. Recomenda-se monitorar a evolução antes de decisões de grande escala."
      : "Os dados apresentam alta variação. As estimativas devem ser usadas como referência direcional.";

  const closeWalkthrough = () => {
    setWalkthroughOpen(false);
    localStorage.setItem(WALKTHROUGH_KEY, "true");
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pattern Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Diagnóstico estrutural de funil por cliente · multiplataforma
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 flex-wrap justify-end">
            {clientLabel && (
              <Badge variant="outline" className="text-xs max-w-[240px] truncate">
                {clientLabel}
                <span className="ml-1.5 text-muted-foreground font-normal">
                  · {clientFunnel.linkedAccounts.length} conta{clientFunnel.linkedAccounts.length !== 1 ? "s" : ""}
                </span>
              </Badge>
            )}
            <PITooltip id="confianca">
              <Badge variant="outline" className={`${confMeta.bg} ${confMeta.color} border gap-1.5 px-3 py-1.5 cursor-help`}>
                <ConfIcon className="w-3.5 h-3.5" />
                {confMeta.label}
              </Badge>
            </PITooltip>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMethodologyOpen(true)}>
              <BookOpen className="w-4 h-4" />
              Metodologia
            </Button>
          </div>
            {dataPeriod && !dataLoading && (
              <p className="text-xs text-muted-foreground/60 text-right">
                {dataPeriod.start} → {dataPeriod.end} · {dataPeriod.days} dias
                {lastSync && ` · sync ${new Date(lastSync).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
              </p>
            )}
          </div>
        </div>

        {/* Confidence insight */}
        <InsightBanner icon={ShieldCheck} text={confidenceInsight} />

        {/* Aviso: sem conversões de fundo */}
        {hasClient && !hasFundoData && !dataLoading && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
            <span>
              Este cliente não possui conversões de fundo classificadas no período. Os KPIs de impacto requerem campanhas de fundo com eventos. Campanhas de topo entram no mapa temporal.
            </span>
          </div>
        )}

        {/* Nota discreta: fundo baseado em cliques */}
        {hasClient && isClickProxy && !dataLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Fundo baseado em cliques (link_clicks) — conta sem pixel de conversão. CPA e ROAS requerem dados de receita real.</span>
          </div>
        )}

        {/* ═══ BLOCO 1 — Resumo Executivo ═══ */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Resumo Executivo</CardTitle>
              <PITooltipIcon id="resumoExecBlock" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <PITooltip id="incrementoEstimado">
                <KPICard
                  label="Conversões Incrementais"
                  value={incrementalImpact.incrementalConversions.toLocaleString("pt-BR")}
                  sub="somente purchase (venda)"
                  icon={Target}
                  trend={periodTrend?.conversoes}
                />
              </PITooltip>
              <PITooltip id="reducaoCPA">
                <KPICard
                  label="Redução de CPA"
                  value={`-${incrementalImpact.cpaReductionPct}%`}
                  sub={`R$ ${incrementalImpact.cpaReduction.toFixed(2)}`}
                  icon={TrendingDown}
                />
              </PITooltip>
              <PITooltip id="impactoROAS">
                <KPICard
                  label="Impacto no ROAS"
                  value={`+${incrementalImpact.roasImpactPct}%`}
                  sub={`+${incrementalImpact.roasImpact.toFixed(2)}`}
                  icon={TrendingUp}
                />
              </PITooltip>
              <PITooltip id="receitaIncremental">
                <KPICard
                  label="Receita Incremental"
                  value={`R$ ${(incrementalImpact.incrementalRevenue / 1000).toFixed(0)}k`}
                  sub="estimada"
                  icon={DollarSign}
                />
              </PITooltip>
            </div>

            {/* Model summary - no technical params */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <PITooltip id="janelaOtima">
                <MiniStat label="Janela de Impacto" value={`${bestLagModel.lagDays} dias`} icon={Clock} trend={periodTrend?.janela} />
              </PITooltip>
              <PITooltip id="ajusteModelo">
                <MiniStat
                  label="Precisão do Modelo"
                  value={`${(bestLagModel.r2Adjusted * 100).toFixed(0)}%`}
                  sub={bestLagModel.r2Adjusted < 0.1 ? "correlação insuficiente" : undefined}
                  icon={BarChart3}
                />
              </PITooltip>
              <PITooltip id="decaimento">
                <MiniStat label="Persistência do Efeito" value={bestAdstock.lambda >= 0.7 ? "Alta" : bestAdstock.lambda >= 0.5 ? "Média" : "Baixa"} icon={Layers} />
              </PITooltip>
            </div>

            {/* AI Summary */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Interpretação Automática</p>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">
                {bestLagModel.r2Adjusted < 0.05
                  ? `Dados insuficientes para correlação estatística (R²≈0%). Os padrões temporais estão disponíveis no Mapa Temporal, mas as estimativas de conversão incremental devem ser usadas apenas como referência direcional. ${elasticityInsight}`
                  : executiveSummary}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ═══ BLOCO 1.5 — Eficiência de Clique ═══ */}
        {clickEfficiency && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Eficiência de Clique</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Métricas de desempenho de mídia no período</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">CTR médio</p>
                  <p className="text-xl font-bold text-foreground">{clickEfficiency.avgCtr.toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground">cliques / impressões</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">CPM médio</p>
                  <p className="text-xl font-bold text-foreground">R$ {clickEfficiency.avgCpm.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">custo / mil impressões</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">CPC médio</p>
                  <p className="text-xl font-bold text-foreground">R$ {clickEfficiency.avgCpc.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">custo por clique</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Cliques únicos</p>
                  <p className="text-xl font-bold text-foreground">{clickEfficiency.totalUniqueClicks.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground">pessoas únicas</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">CTR único</p>
                  <p className="text-xl font-bold text-foreground">{clickEfficiency.avgUniqueCtr.toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground">pessoas únicas / alcance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ BLOCO 2 — Mapa Temporal ═══ */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Mapa Temporal</CardTitle>
              <PITooltipIcon id="mapaTemporalBlock" />
            </div>
            <p className="text-xs text-muted-foreground">Pressão de topo × Conversões de fundo ao longo do tempo</p>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={temporalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={6} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area yAxisId="left" type="monotone" dataKey="tpiAdstock" name="Pressão de Topo" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="conversoes" name="Conversões Fundo" stroke="hsl(var(--status-warning))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* TPI Weights editor */}
            <div className="mt-4 p-3 rounded-lg border border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground">Pesos do Índice de Pressão</p>
                <PITooltipIcon id="tpiPesos" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <WeightSlider label="Alcance" value={tpiWeights.alcance} onChange={(v) => setTpiWeights(prev => ({ ...prev, alcance: v }))} />
                <WeightSlider label="Frequência" value={tpiWeights.frequencia} onChange={(v) => setTpiWeights(prev => ({ ...prev, frequencia: v }))} />
                <WeightSlider label="Investimento" value={tpiWeights.investimento} onChange={(v) => setTpiWeights(prev => ({ ...prev, investimento: v }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ BLOCO 2.5 — Atribuição por Janela ═══ */}
        {attributionSummary && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Atribuição por Janela</CardTitle>
                <PITooltipIcon id="atribuicaoBlock" />
              </div>
              <p className="text-xs text-muted-foreground">Como as conversões se distribuem por tempo e tipo de interação</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <AttrWindowBar attr={attributionSummary} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AttrStat label="Click (1d)" value={attributionSummary.conv1dClick} total={attributionSummary.conv7dClick + attributionSummary.conv7dView} color="bg-primary" />
                <AttrStat label="Click (7d)" value={attributionSummary.conv7dClick} total={attributionSummary.conv7dClick + attributionSummary.conv7dView} color="bg-primary/50" />
                <AttrStat label="View (1d)" value={attributionSummary.conv1dView} total={attributionSummary.conv7dClick + attributionSummary.conv7dView} color="bg-amber-500/80" />
                <AttrStat label="View (7d)" value={attributionSummary.conv7dView} total={attributionSummary.conv7dClick + attributionSummary.conv7dView} color="bg-amber-500/40" />
              </div>
              <InsightBanner icon={Lightbulb} text={
                attributionSummary.viewThroughPct >= 20
                  ? `${attributionSummary.viewThroughPct.toFixed(0)}% das conversões vieram de quem apenas visualizou o anúncio de topo — forte evidência de contribuição indireta do awareness. A janela de impacto real é de até 7 dias.`
                  : attributionSummary.viewThroughPct > 0
                    ? `${attributionSummary.viewThroughPct.toFixed(0)}% das conversões são view-through. A maioria converte após clicar (${(100 - attributionSummary.viewThroughPct).toFixed(0)}%), indicando ciclo de decisão mais curto.`
                    : `Conversões predominantemente via clique direto. ${attributionSummary.cycleLengthRatio > 0.7 ? "Ciclo curto — maioria converte em até 1 dia após o clique." : "Ciclo médio — conversões distribuídas ao longo de 7 dias."}`
              } />
            </CardContent>
          </Card>
        )}

        {/* ═══ BLOCO 3 — Elasticidade e Saturação ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Saturation Curve */}
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Curva de Saturação</CardTitle>
                <PITooltipIcon id="saturacaoBlock" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={satData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="tpi" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Legend verticalAlign="top" wrapperStyle={{ fontSize: "11px", paddingBottom: "8px" }} />
                    <Line yAxisId="right" type="monotone" dataKey="retornoMarginal" name="Ret. Marginal" stroke="hsl(var(--status-error))" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                    <Area yAxisId="left" type="monotone" dataKey="conversoes" name="Conversões" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <InsightBanner icon={Lightbulb} text={saturationInsight} />
            </CardContent>
          </Card>

          {/* Elasticity */}
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Elasticidade Topo → Fundo</CardTitle>
                <PITooltipIcon id="elasticidade" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-foreground">{elasticity.elasticity.toFixed(2)}</p>
                    <TrendTag delta={periodTrend?.elasticidade ?? null} />
                  </div>
                  <Badge variant="outline" className={`mt-2 ${sensitivityMeta[elasticity.sensitivity].bg} ${sensitivityMeta[elasticity.sensitivity].color}`}>
                    {sensitivityMeta[elasticity.sensitivity].label}
                  </Badge>
                </div>
                <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{Math.abs(elasticity.elasticity).toFixed(1)}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs font-medium text-muted-foreground mb-1">Interpretação</p>
                <p className="text-sm text-foreground/85 leading-relaxed">{elasticity.description}</p>
              </div>

              <InsightBanner icon={Lightbulb} text={elasticityInsight} />
            </CardContent>
          </Card>
        </div>

        {/* ═══ BLOCO 4 — Simulador Estratégico ═══ */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Simulador Estratégico</CardTitle>
              <PITooltipIcon id="simuladorBlock" />
            </div>
            <p className="text-xs text-muted-foreground">Simule o impacto de aumentar a pressão de topo de funil</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Simulação</Label>
                  <Select value={simType} onValueChange={(v: "percent" | "absolute") => setSimType(v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Aumento percentual</SelectItem>
                      <SelectItem value="absolute">Valor monetário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{simType === "percent" ? "Aumento (%)" : "Investimento adicional (R$)"}</Label>
                  <Input type="number" value={simValue} onChange={e => setSimValue(Number(e.target.value))} className="h-9 text-sm" />
                </div>
                {simType === "percent" && (
                  <div className="flex gap-2 flex-wrap">
                    {[5, 10, 20, 30].map(v => (
                      <Button key={v} size="sm" variant={simValue === v ? "default" : "outline"} className="text-xs h-7" onClick={() => setSimValue(v)}>+{v}%</Button>
                    ))}
                  </div>
                )}
                {isClickProxy && (
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <Label className="text-xs text-muted-foreground">Ticket médio por clique (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="ex: 120"
                      value={ticketMedio || ""}
                      onChange={e => setTicketMedio(Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground/60">Sem pixel — informe o valor médio por conversão para projetar receita</p>
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                {(() => {
                  const useTicket = ticketMedio > 0;
                  const receitaProjetada = useTicket
                    ? simulation.incrementalConversions * ticketMedio
                    : simulation.incrementalRevenue;
                  return (<>
                    <SimKPI label="Conversões Incrementais" value={`+${simulation.incrementalConversions.toLocaleString("pt-BR")}`} icon={Target} />
                    <SimKPI label="Receita Incremental" value={`R$ ${(receitaProjetada / 1000).toFixed(1)}k`} icon={DollarSign} />
                    <SimKPI label="CPA por Conversão" value={useTicket ? `R$ ${ticketMedio.toFixed(2)}` : `R$ ${simulation.newCPA.toFixed(2)}`} icon={TrendingDown} />
                    <SimKPI label="Novo ROAS Projetado" value={simulation.newROAS.toFixed(2)} icon={TrendingUp} />
                    <SimKPI label="ROI Marginal" value={`${simulation.marginalROI.toFixed(2)}x`} icon={ArrowUpRight} />
                  </>);
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ BLOCO 5 — Campanhas por Etapa de Funil ═══ */}
        {campaigns.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Campanhas por Etapa de Funil</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Classificação pelo Funnel Role Engine (Meta, Google, DV360 e futuras integrações) — visão consolidada do cliente
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 pb-1 border-b border-border/30">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Campanha</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right w-16">Plataforma</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right w-16">Etapa</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right w-20">Investido</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right w-20">Convers.</span>
                </div>
                {campaigns.map(c => (
                  <CampaignRow key={`${c.platform}__${c.campaign_id}`} campaign={c} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ Methodology Drawer ═══ */}
      <MethodologySheet open={methodologyOpen} onOpenChange={setMethodologyOpen} />

      {/* ═══ Walkthrough Dialog ═══ */}
      <WalkthroughDialog
        open={walkthroughOpen}
        step={walkthroughStep}
        onStep={setWalkthroughStep}
        onClose={closeWalkthrough}
      />
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════

function PITooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const tip = TOOLTIPS[id];
  if (!tip) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-[9999] max-w-xs p-3">
          <p className="text-xs font-semibold text-foreground mb-1">{tip.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{tip.text}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

function PITooltipIcon({ id }: { id: string }) {
  return (
    <PITooltip id={id}>
      <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
    </PITooltip>
  );
}

function InsightBanner({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
      <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
      <p className="text-xs text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}

function TrendTag({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${up ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
      {up ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function KPICard({ label, value, sub, icon: Icon, trend }: { label: string; value: string; sub: string; icon: any; trend?: number | null }) {
  return (
    <div className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold text-foreground">{value}</p>
        <TrendTag delta={trend ?? null} />
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, sub, icon: Icon, trend }: { label: string; value: string; sub?: string; icon: any; trend?: number | null }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 cursor-help">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted-foreground/60">({sub})</span>}
      <TrendTag delta={trend ?? null} />
    </div>
  );
}

function SimKPI({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function AttrWindowBar({ attr }: { attr: NonNullable<AttributionSummary> }) {
  const total = attr.conv7dClick + attr.conv7dView;
  if (total === 0) return null;
  const pct = (v: number) => Math.max(0, (v / total) * 100);
  const click1d  = pct(attr.conv1dClick);
  const click7d  = pct(attr.conv7dClick - attr.conv1dClick);
  const view1d   = pct(attr.conv1dView);
  const view7d   = pct(attr.conv7dView - attr.conv1dView);
  return (
    <div className="space-y-2">
      <div className="flex h-7 rounded-lg overflow-hidden gap-px">
        {click1d  > 0 && <div style={{ width: `${click1d}%`  }} className="bg-primary transition-all" title={`Click 1d: ${click1d.toFixed(0)}%`} />}
        {click7d  > 0 && <div style={{ width: `${click7d}%`  }} className="bg-primary/40 transition-all" title={`Click 1-7d: ${click7d.toFixed(0)}%`} />}
        {view1d   > 0 && <div style={{ width: `${view1d}%`   }} className="bg-amber-500/80 transition-all" title={`View 1d: ${view1d.toFixed(0)}%`} />}
        {view7d   > 0 && <div style={{ width: `${view7d}%`   }} className="bg-amber-500/40 transition-all" title={`View 1-7d: ${view7d.toFixed(0)}%`} />}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />Click direto (≤1d)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary/40 inline-block" />Click longo (1-7d)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/80 inline-block" />View (≤1d)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 inline-block" />View (1-7d)</span>
      </div>
    </div>
  );
}

function AttrStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-sm ${color} flex-shrink-0`} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value > 0 ? Math.round(value).toLocaleString("pt-BR") : "—"}</p>
      <p className="text-[11px] text-muted-foreground/60">{pct > 0 ? `${pct.toFixed(0)}% do total` : "sem dados"}</p>
    </div>
  );
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  topo:  { label: "Topo",  color: "text-sky-400",     bg: "bg-sky-400/10 border-sky-400/30" },
  meio:  { label: "Meio",  color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/30" },
  fundo: { label: "Fundo", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  misto: { label: "Misto", color: "text-violet-400",  bg: "bg-violet-400/10 border-violet-400/30" },
  indefinido: { label: "N/D", color: "text-muted-foreground", bg: "bg-muted/40 border-border" },
};

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: "Meta",
  google_ads: "Google",
  dv360: "DV360",
  tiktok_ads: "TikTok",
  kwai_ads: "Kwai",
  linkedin_ads: "LinkedIn",
};

function CampaignRow({ campaign }: { campaign: ClassifiedCampaignSummary }) {
  const stage = STAGE_META[campaign.funnel_stage] ?? STAGE_META.indefinido;
  const platformLabel = PLATFORM_LABEL[campaign.platform] ?? campaign.platform;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors items-center">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{campaign.campaign_name}</p>
        {campaign.objective && <p className="text-[10px] text-muted-foreground/60 truncate">{campaign.objective}</p>}
      </div>
      <span className="text-[10px] text-muted-foreground text-right w-16 truncate">{platformLabel}</span>
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 w-16 justify-center ${stage.bg} ${stage.color} border`} title={campaign.evidence.join(" · ")}>
        {stage.label}
      </Badge>
      <span className="text-xs font-mono text-foreground text-right w-20">
        R$ {campaign.totalSpend >= 1000 ? `${(campaign.totalSpend / 1000).toFixed(1)}k` : campaign.totalSpend.toFixed(0)}
      </span>
      <span className="text-xs font-mono text-foreground text-right w-20">
        {campaign.totalConversions > 0 ? campaign.totalConversions.toLocaleString("pt-BR") : "—"}
      </span>
    </div>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">{(value * 100).toFixed(0)}%</span>
      </div>
      <Slider value={[value * 100]} onValueChange={([v]) => onChange(v / 100)} min={0} max={100} step={5} className="h-4" />
    </div>
  );
}

// ═══ Methodology Sheet ═══

function MethodologySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Metodologia — Pattern Intelligence
          </SheetTitle>
          <p className="text-sm text-muted-foreground">Entenda como funciona o motor de diagnóstico de impacto de funil.</p>
        </SheetHeader>

        <div className="space-y-6 pb-8">
          <MSection icon={<Sparkles className="w-4 h-4 text-primary" />} title="O Que É Pattern Intelligence">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pattern Intelligence é um motor proprietário de análise que identifica padrões estruturais entre campanhas de topo e fundo de funil, estimando impactos incrementais e efeitos de eficiência. O sistema trabalha com séries temporais e controle de variáveis para isolar o efeito real do topo.
            </p>
          </MSection>

          <MSection icon={<Eye className="w-4 h-4 text-primary" />} title="Como a Análise Funciona">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A análise utiliza séries temporais, defasagem de impacto, controle de variáveis externas e modelagem estatística para identificar relações consistentes entre a pressão de topo e os resultados de fundo. O sistema avalia múltiplas janelas de impacto e seleciona automaticamente a configuração mais robusta.
            </p>
          </MSection>

          <MSection icon={<Layers className="w-4 h-4 text-primary" />} title="O Que Significa Cada Bloco">
            <div className="space-y-3">
              <MBlock title="Resumo Executivo" text="Consolida os principais indicadores de impacto: conversões adicionais, redução de custo e ganhos de eficiência gerados pelo topo de funil." />
              <MBlock title="Mapa Temporal" text="Mostra a evolução da pressão de topo sobreposta às conversões de fundo, permitindo visualizar correlações e a janela de impacto." />
              <MBlock title="Elasticidade" text="Mede a sensibilidade dos resultados de fundo em relação a variações na pressão de topo. Quanto maior, mais responsivo é o fundo." />
              <MBlock title="Curva de Saturação" text="Identifica o ponto a partir do qual investimentos adicionais em topo geram retornos cada vez menores, ajudando a otimizar a alocação." />
              <MBlock title="Simulador Estratégico" text="Permite projetar cenários antes de investir, testando aumentos hipotéticos e visualizando o impacto estimado em conversões, CPA e ROAS." />
            </div>
          </MSection>

          <MSection icon={<ShieldCheck className="w-4 h-4 text-primary" />} title="Nível de Confiança">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O sistema avalia automaticamente a consistência histórica dos dados, a estabilidade dos padrões identificados e a variação do investimento ao longo do tempo para atribuir um nível de confiança à análise. Quanto mais estáveis e consistentes os dados, maior a confiança.
            </p>
          </MSection>

          <MSection icon={<Calculator className="w-4 h-4 text-primary" />} title="Como Utilizar o Simulador">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O simulador permite testar cenários estratégicos antes de alocar orçamento adicional, ajudando na tomada de decisão orientada por dados. Insira um aumento percentual ou valor absoluto e visualize instantaneamente o impacto projetado nas métricas-chave.
            </p>
          </MSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
      <p className="text-xs font-semibold text-foreground mb-0.5">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

// ═══ Walkthrough Dialog ═══

function WalkthroughDialog({ open, step, onStep, onClose }: { open: boolean; step: number; onStep: (s: number) => void; onClose: () => void }) {
  const current = WALKTHROUGH_STEPS[step];
  if (!current) return null;
  const Icon = current.icon;
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Guia Rápido • {step + 1} de {WALKTHROUGH_STEPS.length}</span>
          </div>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {current.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed py-2">{current.description}</p>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {WALKTHROUGH_STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-muted-foreground/20"}`} />
          ))}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Pular</Button>
          {isLast ? (
            <Button size="sm" className="gap-1.5" onClick={onClose}>
              <CheckCircle2 className="w-4 h-4" />
              Começar
            </Button>
          ) : (
            <Button size="sm" className="gap-1" onClick={() => onStep(step + 1)}>
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
