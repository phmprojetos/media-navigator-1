import type { CampaignWithClient } from "@/data/multiClientData";
import type { ClientProfitability } from "@/types/financials";
import type { AlertLog } from "@/types/alerts";
import type { AgencyHealthIndex, HealthLevel, ClientTargets, TargetDeviation, AdoptionImpact } from "@/types/operational";
import type { Recommendation } from "@/lib/recommendationEngine";
import type { CampaignForecast } from "@/lib/forecastCalculations";

// ── Agency Health Index (0-100) ──

export function computeAgencyHealthIndex(
  campaigns: CampaignWithClient[],
  profitabilities: ClientProfitability[],
  alerts: AlertLog[],
  forecasts: CampaignForecast[],
  targets: ClientTargets[]
): AgencyHealthIndex {
  const n = campaigns.length;
  if (n === 0) return { score: 50, level: "stable", components: { avgMBEI: 50, marginPercent: 50, alertDensity: 50, momentum: 50, forecastStability: 50, targetAchievement: 50 } };

  // Avg MBEI (0-100 → 100 = 130+, 0 = <70)
  const avgMBEI = campaigns.reduce((s, c) => s + c.currentMBEI, 0) / n;
  const mbeiScore = Math.min(100, Math.max(0, ((avgMBEI - 70) / 60) * 100));

  // Margin % (0-100 → 100 = 40%+, 0 = 0%)
  const avgMargin = profitabilities.length > 0
    ? profitabilities.reduce((s, p) => s + p.marginPercent, 0) / profitabilities.length
    : 0;
  const marginScore = Math.min(100, Math.max(0, (avgMargin / 40) * 100));

  // Alert density (0-100 → fewer = better)
  const alertsPerCampaign = n > 0 ? alerts.filter(a => a.status === "active").length / n : 0;
  const alertScore = Math.min(100, Math.max(0, 100 - alertsPerCampaign * 25));

  // Momentum (0-100)
  const avgDelta = campaigns.reduce((s, c) => s + c.momentumDelta, 0) / n;
  const momentumScore = Math.min(100, Math.max(0, 50 + avgDelta * 5));

  // Forecast stability (0-100)
  const riskForecasts = forecasts.filter(f => f.overallStatus === "high_risk" || f.overallStatus === "slight_risk").length;
  const forecastScore = forecasts.length > 0 ? Math.max(0, 100 - (riskForecasts / forecasts.length) * 100) : 50;

  // Target achievement (0-100)
  const targetScore = targets.length > 0 ? 65 : 50; // Placeholder baseline

  const score = Math.round(
    mbeiScore * 0.25 +
    marginScore * 0.20 +
    alertScore * 0.15 +
    momentumScore * 0.15 +
    forecastScore * 0.15 +
    targetScore * 0.10
  );

  let level: HealthLevel;
  if (score >= 85) level = "excellent";
  else if (score >= 70) level = "strong";
  else if (score >= 50) level = "stable";
  else if (score >= 30) level = "at_risk";
  else level = "critical";

  return {
    score,
    level,
    components: {
      avgMBEI: Math.round(mbeiScore),
      marginPercent: Math.round(marginScore),
      alertDensity: Math.round(alertScore),
      momentum: Math.round(momentumScore),
      forecastStability: Math.round(forecastScore),
      targetAchievement: Math.round(targetScore),
    },
  };
}

// ── Target Deviations ──

export function computeTargetDeviations(
  targets: ClientTargets[],
  profitabilities: ClientProfitability[],
  campaigns: CampaignWithClient[]
): TargetDeviation[] {
  const deviations: TargetDeviation[] = [];
  const threshold = 10; // flag if deviation > 10%

  for (const t of targets) {
    const prof = profitabilities.find(p => p.clientId === t.clientId);
    const clientCampaigns = campaigns.filter(c => c.clientId === t.clientId);
    if (!prof || clientCampaigns.length === 0) continue;

    const avgMBEI = Math.round(clientCampaigns.reduce((s, c) => s + c.currentMBEI, 0) / clientCampaigns.length);
    const avgCPA = clientCampaigns.reduce((s, c) => s + c.rollingCPA, 0) / clientCampaigns.length;

    const checks: { metric: string; target: number; actual: number }[] = [
      { metric: "MBEI", target: t.targetMBEI, actual: avgMBEI },
      { metric: "Margem %", target: t.targetMargin, actual: prof.marginPercent },
      { metric: "CPA", target: t.targetCPA, actual: avgCPA },
    ];

    for (const check of checks) {
      const deviation = check.target !== 0 ? ((check.actual - check.target) / check.target) * 100 : 0;
      // For CPA, higher is worse (invert flag)
      const isBad = check.metric === "CPA" ? deviation > threshold : deviation < -threshold;
      deviations.push({
        clientId: t.clientId,
        clientName: prof.clientName,
        metric: check.metric,
        target: check.target,
        actual: Math.round(check.actual * 10) / 10,
        deviation: Math.round(deviation * 10) / 10,
        flagged: isBad,
      });
    }
  }

  return deviations;
}

/** Adoption impact — zeros until tracking is wired to real outcomes. */
export function computeAdoptionImpact(): AdoptionImpact {
  return {
    totalSavings: 0,
    cpaReduction: 0,
    alertResolutionRate: 0,
    marginImprovement: 0,
    recommendationsApplied: 0,
    efficiencyImprovement: 0,
    monthsTracked: 0,
  };
}
