/**
 * ═══════════════════════════════════════════════════════════════
 * ISO CALCULATION ENGINE
 * ═══════════════════════════════════════════════════════════════
 *
 * Computa o Índice de Saúde da Operação (ISO) a partir de sinais
 * já existentes no Feature Store. Camada de consolidação pura —
 * não recalcula nenhuma métrica.
 *
 * Inputs (todos do Feature Store):
 *   - campaigns, agencyAggregation
 *   - clientProfitabilities
 *   - alerts
 *   - campaignForecasts
 * ═══════════════════════════════════════════════════════════════
 */

import type { CampaignWithClient } from "@/data/multiClientData";
import type { AgencyAggregation } from "@/types/efficiency";
import type { ClientProfitability } from "@/types/financials";
import type { AlertLog } from "@/types/alerts";
import type { CampaignForecast } from "@/lib/forecastCalculations";
import type { ISOScore } from "@/types/iso";
import { classifyISO } from "@/types/iso";

export function computeISO(
  campaigns: CampaignWithClient[],
  agencyAgg: AgencyAggregation,
  profitabilities: ClientProfitability[],
  alerts: AlertLog[],
  forecasts: CampaignForecast[]
): ISOScore {
  const n = campaigns.length;

  if (n === 0) {
    return {
      available: false,
      score: 0,
      classification: "indisponivel",
      classificationLabel: "Sem dados",
      trend: "stable",
      trendDelta: 0,
      components: {
        performance: 0,
        efficiency: 0,
        stability: 0,
        evolution: 0,
        operational: 0,
      },
      aiSummary:
        "ISO indisponível: não há campanhas sincronizadas neste filtro. Conecte uma plataforma e sincronize dados para calcular a saúde da operação.",
    };
  }

  // ── 1. Entrega de Resultado (30%) ──
  // Based on conversion delivery and goal probability
  const avgGoalProb = forecasts.length > 0
    ? forecasts.reduce((s, f) => s + f.goalProbability, 0) / forecasts.length
    : 50;
  // Normalize: goalProbability is already 0-100
  const performanceScore = Math.min(100, Math.max(0, avgGoalProb));

  // ── 2. Eficiência de Investimento (20%) ──
  // Based on spend velocity (1.0 = ideal)
  const avgVelocity = campaigns.reduce((s, c) => s + c.spendVelocity, 0) / n;
  // Perfect velocity = 1.0 → 100. Deviation reduces score.
  const velocityDeviation = Math.abs(avgVelocity - 1.0);
  const efficiencyScore = Math.min(100, Math.max(0, 100 - velocityDeviation * 200));

  // ── 3. Estabilidade Estrutural (15%) ──
  // Based on alert density + forecast stability
  const activeAlerts = alerts.filter(a => a.status === "active").length;
  const alertDensity = n > 0 ? activeAlerts / n : 0;
  const alertComponent = Math.min(100, Math.max(0, 100 - alertDensity * 25));

  const riskForecasts = forecasts.filter(f => f.overallStatus === "high_risk" || f.overallStatus === "slight_risk").length;
  const forecastStab = forecasts.length > 0 ? Math.max(0, 100 - (riskForecasts / forecasts.length) * 100) : 50;

  const stabilityScore = Math.round(alertComponent * 0.5 + forecastStab * 0.5);

  // ── 4. Evolução Temporal (20%) ──
  // Based on momentum delta across campaigns
  const avgDelta = campaigns.reduce((s, c) => s + c.momentumDelta, 0) / n;
  // Delta range approx -10 to +10. Map to 0-100 (0 at -10, 50 at 0, 100 at +10)
  const evolutionScore = Math.min(100, Math.max(0, 50 + avgDelta * 5));

  // ── 5. Qualidade Operacional (15%) ──
  // Based on margin health + operational efficiency
  const avgMargin = profitabilities.length > 0
    ? profitabilities.reduce((s, p) => s + p.marginPercent, 0) / profitabilities.length
    : 0;
  const marginComponent = Math.min(100, Math.max(0, (avgMargin / 40) * 100));

  // CPA efficiency proxy: how many campaigns have CPA within acceptable range
  const cpaGoodRatio = campaigns.filter(c => c.spendVelocity <= 1.05).length / n;
  const cpaComponent = cpaGoodRatio * 100;

  const operationalScore = Math.round(marginComponent * 0.5 + cpaComponent * 0.5);

  return buildISO(performanceScore, efficiencyScore, stabilityScore, evolutionScore, operationalScore, avgDelta);
}

function buildISO(
  performance: number,
  efficiency: number,
  stability: number,
  evolution: number,
  operational: number,
  momentumDelta: number
): ISOScore {
  const score = Math.round(
    performance * 0.30 +
    efficiency * 0.20 +
    stability * 0.15 +
    evolution * 0.20 +
    operational * 0.15
  );

  const { classification, label } = classifyISO(score);

  const trend: "up" | "down" | "stable" =
    momentumDelta >= 1 ? "up" : momentumDelta <= -1 ? "down" : "stable";

  // AI Summary — identify the weakest component
  const components = { performance, efficiency, stability, evolution, operational };
  const weakest = (Object.entries(components) as [keyof typeof components, number][])
    .sort((a, b) => a[1] - b[1])[0];

  const componentNames: Record<string, string> = {
    performance: "entrega de resultado",
    efficiency: "eficiência de investimento",
    stability: "estabilidade estrutural",
    evolution: "evolução temporal",
    operational: "qualidade operacional",
  };

  const aiSummary = score >= 90
    ? "Operação em excelente estado. Todos os componentes acima do limiar de saúde."
    : score >= 75
    ? `Operação saudável. O componente "${componentNames[weakest[0]]}" (${Math.round(weakest[1])}) é o que mais pode melhorar.`
    : score >= 60
    ? `Atenção necessária. O fator principal de impacto é "${componentNames[weakest[0]]}" (${Math.round(weakest[1])}). Revise as ações associadas.`
    : `Estado crítico. "${componentNames[weakest[0]]}" (${Math.round(weakest[1])}) exige ação imediata para recuperar a saúde da operação.`;

  return {
    available: true,
    score,
    classification,
    classificationLabel: label,
    trend,
    trendDelta: Math.round(momentumDelta * 10) / 10,
    components: {
      performance: Math.round(performance),
      efficiency: Math.round(efficiency),
      stability: Math.round(stability),
      evolution: Math.round(evolution),
      operational: Math.round(operational),
    },
    aiSummary,
  };
}
