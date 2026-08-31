import type { ClientFinancials, ClientProfitability } from "@/types/financials";
import { MARGIN_THRESHOLD } from "@/types/financials";
import type { CampaignWithClient } from "@/data/multiClientData";

function computeMediaSpend(campaigns: CampaignWithClient[]): number {
  return campaigns.reduce((s, c) => s + (c.spend ?? c.rollingCPA * 500 * c.spendVelocity), 0);
}

export function computeManagementRevenue(financials: ClientFinancials, mediaSpend: number): number {
  switch (financials.fee_type) {
    case "percentage":
      return mediaSpend * (financials.percentage_fee / 100);
    case "fixed":
      return financials.fixed_fee_value;
    case "hybrid":
      return mediaSpend * (financials.percentage_fee / 100) + financials.fixed_fee_value;
    default:
      return 0;
  }
}

export function computeBVRevenue(financials: ClientFinancials, mediaSpend: number): number {
  return mediaSpend * (financials.bv_percentage / 100);
}

export function computeClientProfitability(
  clientId: string,
  clientName: string,
  campaigns: CampaignWithClient[],
  financials: ClientFinancials,
  alertsCount: number,
  avgMBEI: number
): ClientProfitability {
  const mediaSpend = computeMediaSpend(campaigns);
  const managementRevenue = computeManagementRevenue(financials, mediaSpend);
  const bvRevenue = computeBVRevenue(financials, mediaSpend);
  const grossRevenue = managementRevenue + bvRevenue;
  const operationalCost = financials.estimated_operational_cost;
  const grossMargin = grossRevenue - operationalCost;
  const marginPercent = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;

  return {
    clientId,
    clientName,
    mediaSpend,
    managementRevenue,
    bvRevenue,
    grossRevenue,
    operationalCost,
    grossMargin,
    marginPercent,
    avgMBEI,
    alertsCount,
    financialRisk: marginPercent < MARGIN_THRESHOLD,
  };
}

export function computeAgencyFinancials(profitabilities: ClientProfitability[]) {
  const totalRevenue = profitabilities.reduce((s, p) => s + p.grossRevenue, 0);
  const totalMargin = profitabilities.reduce((s, p) => s + p.grossMargin, 0);
  const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const belowTarget = profitabilities.filter(p => p.financialRisk).length;

  return { totalRevenue, totalMargin, marginPercent, belowTarget };
}
