import type { CampaignWithClient } from "@/data/multiClientData";
import { calculateMBEI } from "@/components/dashboard/MBEIScoreCard";
import { getMomentumCategory } from "@/lib/efficiencyCalculations";

export const PLATFORM_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  dv360: "DV360",
  linkedin: "LinkedIn",
  tiktok_ads: "TikTok Ads",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export type FunnelCampaignRow = {
  platform: string;
  account_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  date: string;
  investimento: number;
  impressoes: number;
  conversoes: number;
  funnel_stage?: string | null;
};

export type AccountClient = {
  id: string;
  name: string;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cpa(spend: number, conversions: number): number {
  return conversions > 0 ? spend / conversions : 0;
}

function mbeiFromWindows(currentSpend: number, currentConv: number, baselineSpend: number, baselineConv: number): number {
  const realCPA = cpa(currentSpend, currentConv);
  const plannedCPA = cpa(baselineSpend, baselineConv) || realCPA || 0;
  if (currentSpend <= 0 && currentConv <= 0) return 100;
  if (currentConv <= 0) return 80;
  if (plannedCPA <= 0) return 100;
  return calculateMBEI({
    plannedCPA,
    realCPA,
    plannedBudget: currentSpend,
    realSpend: currentSpend,
    realConversions: currentConv,
    plannedConversions: currentConv,
  }).score;
}

function mergeDailyRows(rows: FunnelCampaignRow[]): FunnelCampaignRow[] {
  const byStage = new Map<string, FunnelCampaignRow>();
  for (const row of rows) {
    const key = `${row.platform}|${row.account_id}|${row.campaign_id || ""}|${row.date}|${row.funnel_stage || ""}`;
    const prev = byStage.get(key);
    if (!prev || num(row.investimento) > num(prev.investimento)) byStage.set(key, row);
  }

  const byDay = new Map<string, FunnelCampaignRow>();
  for (const row of byStage.values()) {
    const key = `${row.platform}|${row.account_id}|${row.campaign_id || ""}|${row.date}`;
    const prev = byDay.get(key);
    if (!prev) {
      byDay.set(key, {
        ...row,
        investimento: num(row.investimento),
        impressoes: num(row.impressoes),
        conversoes: num(row.conversoes),
      });
      continue;
    }
    prev.investimento = num(prev.investimento) + num(row.investimento);
    prev.impressoes = num(prev.impressoes) + num(row.impressoes);
    prev.conversoes = num(prev.conversoes) + num(row.conversoes);
    if (row.campaign_name && !prev.campaign_name) prev.campaign_name = row.campaign_name;
  }
  return [...byDay.values()];
}

/**
 * Agrega funnel_daily_records em CampaignWithClient para o Feature Store.
 */
export function mapFunnelRowsToCampaigns(
  rows: FunnelCampaignRow[],
  accountToClient: Map<string, AccountClient>
): CampaignWithClient[] {
  if (rows.length === 0) return [];

  const withCampaign = rows.filter((r) => r.campaign_id && r.campaign_id !== "");
  const accountsWithCampaigns = new Set(withCampaign.map((r) => `${r.platform}__${r.account_id}`));
  const usable = rows.filter((r) => {
    if (r.campaign_id && r.campaign_id !== "") return true;
    return !accountsWithCampaigns.has(`${r.platform}__${r.account_id}`);
  });

  const uniqueRows = mergeDailyRows(usable);
  if (uniqueRows.length === 0) return [];

  const maxDate = uniqueRows.reduce((m, r) => (r.date > m ? r.date : m), "");
  if (!maxDate) return [];

  const last7Start = addDays(maxDate, -6);
  const prev7Start = addDays(maxDate, -13);
  const prev7End = addDays(maxDate, -7);
  const last30Start = addDays(maxDate, -29);
  const sparkDates = Array.from({ length: 7 }, (_, i) => addDays(maxDate, -6 + i));

  type Acc = {
    platform: string;
    accountId: string;
    campaignId: string;
    campaignName: string;
    lastDate: string;
    last7Spend: number;
    last7Conv: number;
    last7Impr: number;
    prev7Spend: number;
    prev7Conv: number;
    last30Spend: number;
    last30Conv: number;
    last30Impr: number;
    spark: number[];
  };

  const groups = new Map<string, Acc>();

  for (const row of uniqueRows) {
    const client = accountToClient.get(`${row.platform}__${row.account_id}`);
    if (!client) continue;

    const campaignId = row.campaign_id && row.campaign_id !== "" ? row.campaign_id : `__account__${row.account_id}`;
    const key = `${row.platform}__${campaignId}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        platform: row.platform,
        accountId: row.account_id,
        campaignId,
        campaignName: row.campaign_name || campaignId,
        lastDate: row.date,
        last7Spend: 0,
        last7Conv: 0,
        last7Impr: 0,
        prev7Spend: 0,
        prev7Conv: 0,
        last30Spend: 0,
        last30Conv: 0,
        last30Impr: 0,
        spark: sparkDates.map(() => 0),
      };
      groups.set(key, acc);
    }

    if (row.campaign_name && acc.campaignName === acc.campaignId) acc.campaignName = row.campaign_name;
    if (row.date > acc.lastDate) acc.lastDate = row.date;

    const spend = num(row.investimento);
    const conv = num(row.conversoes);
    const impr = num(row.impressoes);

    if (row.date >= last30Start) {
      acc.last30Spend += spend;
      acc.last30Conv += conv;
      acc.last30Impr += impr;
    }
    if (row.date >= last7Start) {
      acc.last7Spend += spend;
      acc.last7Conv += conv;
      acc.last7Impr += impr;
      const sparkIdx = sparkDates.indexOf(row.date);
      if (sparkIdx >= 0) acc.spark[sparkIdx] += spend;
    } else if (row.date >= prev7Start && row.date <= prev7End) {
      acc.prev7Spend += spend;
      acc.prev7Conv += conv;
    }
  }

  const out: CampaignWithClient[] = [];

  for (const acc of groups.values()) {
    const client = accountToClient.get(`${acc.platform}__${acc.accountId}`);
    if (!client) continue;
    if (acc.last30Spend <= 0 && acc.last30Impr <= 0 && acc.last30Conv <= 0) continue;

    const currentMBEI = mbeiFromWindows(acc.last7Spend, acc.last7Conv, acc.prev7Spend, acc.prev7Conv);
    const avgMBEI7d = mbeiFromWindows(acc.prev7Spend, acc.prev7Conv, acc.prev7Spend, acc.prev7Conv);
    const { category, delta } = getMomentumCategory(currentMBEI, avgMBEI7d || currentMBEI);
    const expected7 = acc.last30Spend > 0 ? (acc.last30Spend / 30) * 7 : acc.last7Spend;
    const spendVelocity = expected7 > 0 ? acc.last7Spend / expected7 : 1;
    const active = acc.lastDate >= addDays(maxDate, -13);

    out.push({
      campaignId: acc.campaignId,
      campaignName: acc.campaignName,
      platform: platformLabel(acc.platform),
      clientId: client.id,
      clientName: client.name,
      accountId: acc.accountId,
      status: active ? "active" : "paused",
      currentMBEI,
      avgMBEI7d: avgMBEI7d || currentMBEI,
      momentum: category,
      momentumDelta: delta,
      rollingCPA: cpa(acc.last30Spend, acc.last30Conv),
      rollingConversionRate: acc.last30Impr > 0 ? acc.last30Conv / acc.last30Impr : 0,
      spendVelocity,
      sparklineData: acc.spark,
      spend: acc.last30Spend,
      conversions: acc.last30Conv,
      impressions: acc.last30Impr,
    });
  }

  return out.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}
