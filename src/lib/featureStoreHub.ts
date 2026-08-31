/**
 * ═══════════════════════════════════════════════════════════════
 * FEATURE STORE HUB — Single Source of Truth
 * ═══════════════════════════════════════════════════════════════
 *
 * This module materializes ALL intelligence signals once and
 * serves them to every consumer. No downstream module should
 * recompute metrics that originate here.
 *
 * DATA FLOW:
 *   Raw Data → Standardization → Feature Store Hub → Consumers
 *
 * CONSUMERS (read-only from hub):
 *   - AI Copilot Engine
 *   - Recommendation Engine
 *   - Operational Calculations
 *   - Benchmark Calculations
 *   - Dashboard components
 *   - Pages
 *
 * SIGNAL PROVIDERS (feed into hub):
 *   - efficiencyCalculations (momentum, velocity)
 *   - financialCalculations (revenue, margin)
 *   - forecastCalculations (CPA/MBEI/conversion projections)
 *   - statisticalCalculations (elasticity, saturation, funnel, margin sensitivity, clusters)
 *   - patternLearningEngine (behavioral patterns)
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { CampaignWithClient } from "@/data/multiClientData";
import type { AlertLog } from "@/types/alerts";
import type { ClientProfitability } from "@/types/financials";
import type { CampaignForecast, ClientFinancialForecast } from "@/lib/forecastCalculations";
import type { AgencyAggregation } from "@/types/efficiency";
import type { BudgetElasticityAnalysis, FrequencySaturationAnalysis, FunnelInteractionAnalysis, MarginSensitivityAnalysis, ClientPerformanceCluster } from "@/types/statisticalIntelligence";
import type { Recommendation } from "@/lib/recommendationEngine";
import type { AIGeneratedInsight } from "@/types/aiCopilot";
import type { AgencyHealthIndex, ClientTargets } from "@/types/operational";
import type { AgencyBenchmark, RiskScore } from "@/lib/benchmarkCalculations";
import type { LearnedPattern } from "@/types/patternLearning";
import type { ISOScore } from "@/types/iso";
import type { IMCScore, AgencyIMCSummary } from "@/types/imc";

// ── Materialized Feature Store ──

export interface MaterializedFeatureStore {
  // Identity
  tenantId: string;
  materializedAt: string;

  // ── EFFICIENCY SIGNALS ──
  agencyAggregation: AgencyAggregation;

  // ── FINANCIAL SIGNALS ──
  clientProfitabilities: ClientProfitability[];
  agencyFinancials: { totalRevenue: number; totalMargin: number; marginPercent: number; belowTarget: number };

  // ── FORECAST SIGNALS ──
  campaignForecasts: Map<string, CampaignForecast>;
  clientFinancialForecasts: ClientFinancialForecast[];

  // ── STATISTICAL SIGNALS ──
  elasticityAnalyses: BudgetElasticityAnalysis[];
  saturationAnalyses: FrequencySaturationAnalysis[];
  funnelInteractions: FunnelInteractionAnalysis[];
  marginSensitivities: MarginSensitivityAnalysis[];
  clientClusters: ClientPerformanceCluster[];

  // ── RISK SIGNALS ──
  clientRiskScores: Map<string, RiskScore>;
  agencyBenchmark: AgencyBenchmark;

  // ── PATTERN SIGNALS ──
  learnedPatterns: LearnedPattern[];

  // ── BEHAVIORAL SIGNALS ──
  recommendations: Recommendation[];
  aiInsights: AIGeneratedInsight[];

  // ── OPERATIONAL SIGNALS ──
  agencyHealthIndex: AgencyHealthIndex;

  // ── ISO — Índice de Saúde da Operação ──
  iso: ISOScore;

  // ── IMC — Índice de Maturidade do Cliente ──
  clientIMCScores: IMCScore[];
  agencyIMCSummary: AgencyIMCSummary;
}

// ── Computation Imports (signal providers) ──

import { computeAgencyAggregation } from "@/lib/efficiencyCalculations";
import { computeClientProfitability, computeAgencyFinancials } from "@/lib/financialCalculations";
import { computeCampaignForecast, computeClientFinancialForecast } from "@/lib/forecastCalculations";
import { computeBudgetElasticity, computeFrequencySaturation, computeFunnelInteraction, computeMarginSensitivity, computeClientClusters } from "@/lib/statisticalCalculations";
import { computeAgencyBenchmark, computeRiskScore } from "@/lib/benchmarkCalculations";
import { generateRecommendations } from "@/lib/recommendationEngine";
import { generateAIInsights } from "@/lib/aiCopilotEngine";
import { computeAgencyHealthIndex } from "@/lib/operationalCalculations";
import { runPatternDetection } from "@/lib/patternLearningEngine";
import { computeISO } from "@/lib/isoCalculations";
import { computeClientIMC, computeAgencyIMCSummary } from "@/lib/imcCalculations";
import { getMomentumCategory } from "@/lib/efficiencyCalculations";
import { CLIENT_FINANCIALS } from "@/data/clientFinancials";
import { CLIENT_TARGETS } from "@/data/operationalData";
import { generateAlerts } from "@/types/alerts";
import { LEARNED_PATTERNS } from "@/data/patternLearningData";

// ── Cache ──

let cachedStore: MaterializedFeatureStore | null = null;
let cacheKey: string = "";

function buildCacheKey(campaigns: CampaignWithClient[]): string {
  return `${campaigns.length}_${campaigns.map(c => `${c.campaignId}:${c.currentMBEI}`).join(",")}`;
}

// ── Materializer ──

export function materializeFeatureStore(
  campaigns: CampaignWithClient[],
  tenantId: string = "default"
): MaterializedFeatureStore {
  const key = buildCacheKey(campaigns);
  if (cachedStore && cacheKey === key) return cachedStore;

  const now = new Date().toISOString();
  const alerts = generateAlerts(campaigns);

  // ── 1. Efficiency Signals ──
  const trendData = campaigns.map(c => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    platform: c.platform,
    currentMBEI: c.currentMBEI,
    avgMBEI7d: c.avgMBEI7d,
    momentum: c.momentum,
    momentumDelta: c.momentumDelta,
    rollingCPA: c.rollingCPA,
    rollingConversionRate: c.rollingConversionRate,
    spendVelocity: c.spendVelocity,
    sparklineData: c.sparklineData,
  }));
  const agencyAggregation = computeAgencyAggregation(trendData);

  // ── 2. Financial Signals ──
  const clientMap = new Map<string, CampaignWithClient[]>();
  campaigns.forEach(c => {
    const arr = clientMap.get(c.clientId) || [];
    arr.push(c);
    clientMap.set(c.clientId, arr);
  });

  const clientProfitabilities: ClientProfitability[] = [];
  clientMap.forEach((camps, clientId) => {
    const fin = CLIENT_FINANCIALS.find(f => f.client_id === clientId);
    if (!fin) return;
    const avgMBEI = Math.round(camps.reduce((s, c) => s + c.currentMBEI, 0) / camps.length);
    const clientAlerts = alerts.filter(a => camps.some(c => c.campaignId === a.campaign_id));
    clientProfitabilities.push(
      computeClientProfitability(clientId, camps[0].clientName, camps, fin, clientAlerts.length, avgMBEI)
    );
  });
  const agencyFinancials = computeAgencyFinancials(clientProfitabilities);

  // ── 3. Forecast Signals (computed ONCE) ──
  const campaignForecasts = new Map<string, CampaignForecast>();
  campaigns.forEach(c => campaignForecasts.set(c.campaignId, computeCampaignForecast(c)));

  const clientFinancialForecasts: ClientFinancialForecast[] = [];
  clientMap.forEach((camps, clientId) => {
    const prof = clientProfitabilities.find(p => p.clientId === clientId);
    if (prof) {
      clientFinancialForecasts.push(
        computeClientFinancialForecast(clientId, camps[0].clientName, camps, prof)
      );
    }
  });

  // ── 4. Statistical Signals (computed ONCE) ──
  const elasticityAnalyses = computeBudgetElasticity(campaigns);
  const saturationAnalyses = computeFrequencySaturation(campaigns);
  const funnelInteractions = computeFunnelInteraction(campaigns);
  const marginSensitivities = computeMarginSensitivity(campaigns);
  const clientClusters = computeClientClusters(campaigns, alerts);

  // ── 5. Risk Signals ──
  const agencyBenchmark = computeAgencyBenchmark(campaigns, clientProfitabilities);
  const clientRiskScores = new Map<string, RiskScore>();
  clientMap.forEach((camps, clientId) => {
    const avgMBEI = Math.round(camps.reduce((s, c) => s + c.currentMBEI, 0) / camps.length);
    const avgCurrentMBEI = Math.round(camps.reduce((s, c) => s + c.currentMBEI, 0) / camps.length);
    const avgMBEI7d = Math.round(camps.reduce((s, c) => s + c.avgMBEI7d, 0) / camps.length);
    const { category } = getMomentumCategory(avgCurrentMBEI, avgMBEI7d);
    const clientAlerts = alerts.filter(a => camps.some(c => c.campaignId === a.campaign_id));
    const prof = clientProfitabilities.find(p => p.clientId === clientId);
    clientRiskScores.set(clientId, computeRiskScore(avgMBEI, category, clientAlerts.length, prof?.marginPercent ?? 0));
  });

  // ── 6. Pattern Signals ──
  const learnedPatterns = LEARNED_PATTERNS;

  // ── 7. Behavioral Signals ──
  const recommendations = generateRecommendations(campaigns, alerts, campaignForecasts);
  const aiInsights = generateAIInsights(campaigns, alerts, campaignForecasts);

  // ── 8. Operational Signals ──
  const forecastsArray = Array.from(campaignForecasts.values());
  const agencyHealthIndex = computeAgencyHealthIndex(
    campaigns, clientProfitabilities, alerts, forecastsArray, CLIENT_TARGETS
  );

  // ── 9. ISO — Índice de Saúde da Operação ──
  const iso = computeISO(campaigns, agencyAggregation, clientProfitabilities, alerts, forecastsArray);

  // ── 10. IMC — Índice de Maturidade do Cliente ──
  const clientIMCScores: IMCScore[] = [];
  clientMap.forEach((camps, clientId) => {
    const clientAlerts = alerts.filter(a => camps.some(c => c.campaignId === a.campaign_id));
    const clientForecasts = forecastsArray.filter(f => camps.some(c => c.campaignId === f.campaignId));
    clientIMCScores.push(
      computeClientIMC(
        clientId, camps[0].clientName, camps, clientAlerts, clientForecasts,
        elasticityAnalyses, saturationAnalyses, funnelInteractions, recommendations
      )
    );
  });
  const agencyIMCSummary = computeAgencyIMCSummary(clientIMCScores);

  // ── Materialize ──
  const store: MaterializedFeatureStore = {
    tenantId,
    materializedAt: now,
    agencyAggregation,
    clientProfitabilities,
    agencyFinancials,
    campaignForecasts,
    clientFinancialForecasts,
    elasticityAnalyses,
    saturationAnalyses,
    funnelInteractions,
    marginSensitivities,
    clientClusters,
    clientRiskScores,
    agencyBenchmark,
    learnedPatterns,
    recommendations,
    aiInsights,
    agencyHealthIndex,
    iso,
    clientIMCScores,
    agencyIMCSummary,
  };

  cachedStore = store;
  cacheKey = key;
  return store;
}

// ── Convenience Accessors ──

export function getStoreForecast(store: MaterializedFeatureStore, campaignId: string): CampaignForecast | undefined {
  return store.campaignForecasts.get(campaignId);
}

export function getStoreRiskScore(store: MaterializedFeatureStore, clientId: string): RiskScore | undefined {
  return store.clientRiskScores.get(clientId);
}

export function getStoreProfitability(store: MaterializedFeatureStore, clientId: string): ClientProfitability | undefined {
  return store.clientProfitabilities.find(p => p.clientId === clientId);
}

export function invalidateFeatureStoreCache(): void {
  cachedStore = null;
  cacheKey = "";
}
