import type { FunnelDailyRecord } from "@/types/funnelImpact";
import type { FunnelClassification, FunnelRole } from "./types";
import { classifyCampaign } from "./registry";

export type FunnelMetricRow = {
  platform: string;
  account_id: string;
  campaign_id: string;
  campaign_name: string | null;
  objective: string | null;
  date: string;
  funnel_stage: string;
  investimento: number;
  alcance: number;
  frequencia: number;
  impressoes: number;
  conversoes: number;
  receita: number;
  synced_at?: string;
  conv_1d_click?: number;
  conv_7d_click?: number;
  conv_1d_view?: number;
  conv_7d_view?: number;
  ctr?: number;
  cpm?: number;
  cpc?: number;
  unique_clicks?: number;
  unique_ctr?: number;
};

export type ClassifiedCampaignSummary = {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  objective: string;
  funnel_stage: FunnelRole;
  confidence: FunnelClassification["confidence"];
  evidence: string[];
  totalSpend: number;
  totalConversions: number;
};

type DayAgg = {
  investimentoTopo: number;
  investimentoFundo: number;
  investimentoMeio: number;
  alcanceTopo: number;
  frequenciaTopo: number;
  frequenciaTopoCount: number;
  impressoesTopo: number;
  conversoesFundo: number;
  receitaFundo: number;
  conv_1d_click: number;
  conv_7d_click: number;
  conv_1d_view: number;
  conv_7d_view: number;
  ctrSum: number;
  cpmSum: number;
  cpcSum: number;
  unique_clicks: number;
  unique_ctrSum: number;
  topoMetricRows: number;
};

function emptyDay(): DayAgg {
  return {
    investimentoTopo: 0,
    investimentoFundo: 0,
    investimentoMeio: 0,
    alcanceTopo: 0,
    frequenciaTopo: 0,
    frequenciaTopoCount: 0,
    impressoesTopo: 0,
    conversoesFundo: 0,
    receitaFundo: 0,
    conv_1d_click: 0,
    conv_7d_click: 0,
    conv_1d_view: 0,
    conv_7d_view: 0,
    ctrSum: 0,
    cpmSum: 0,
    cpcSum: 0,
    unique_clicks: 0,
    unique_ctrSum: 0,
    topoMetricRows: 0,
  };
}

/**
 * Conversões de venda (purchase) apenas.
 * - Com receita > 0: há purchase value → conta conversoes da linha
 * - Objetivo de sales/purchase em campanha real (não agregado de conta)
 * - Agregado de conta Meta sem receita: 0 até re-sync purchase-only
 */
export function toPurchaseConversions(row: FunnelMetricRow): number {
  const conv = Number(row.conversoes || 0);
  if (conv <= 0) return 0;
  const rec = Number(row.receita || 0);
  const obj = (row.objective || "").toUpperCase();
  const isAccountAgg = (row.campaign_id || "").startsWith("__account__");

  if (rec > 0) return conv;

  const salesObjective =
    obj.includes("OUTCOME_SALES") ||
    obj.includes("PRODUCT_CATALOG") ||
    obj.includes("PURCHASE") ||
    obj.includes("SHOPPING");

  if (salesObjective && !isAccountAgg) return conv;

  return 0;
}

/**
 * Agrega métricas diárias de múltiplas plataformas/contas
 * usando o FunnelRole do motor (não o funnel_stage legado do sync).
 */
export function buildClientFunnelFromCampaignRows(rows: FunnelMetricRow[]): {
  series: FunnelDailyRecord[];
  campaigns: ClassifiedCampaignSummary[];
  lastSync: string | null;
  attribution: {
    conv1dClick: number;
    conv7dClick: number;
    conv1dView: number;
    conv7dView: number;
  };
  clickEfficiency: {
    avgCtr: number;
    avgCpm: number;
    avgCpc: number;
    totalUniqueClicks: number;
    avgUniqueCtr: number;
  } | null;
} {
  const campaignRows = rows.filter((r) => r.campaign_id && r.campaign_id !== "");
  const byCampaign = new Map<
    string,
    {
      platform: string;
      campaign_id: string;
      campaign_name: string;
      objective: string;
      spend: number;
      conversions: number;
      classification: FunnelClassification;
    }
  >();

  let lastSync: string | null = null;

  for (const row of campaignRows) {
    if (row.synced_at && (!lastSync || row.synced_at > lastSync)) lastSync = row.synced_at;
    const key = `${row.platform}__${row.campaign_id}`;
    let entry = byCampaign.get(key);
    if (!entry) {
      const classification = classifyCampaign({
        platform: row.platform,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        objective: row.objective,
        spend: 0,
        conversions: 0,
      });
      entry = {
        platform: row.platform,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || row.campaign_id,
        objective: row.objective || "",
        spend: 0,
        conversions: 0,
        classification,
      };
      byCampaign.set(key, entry);
    }
    entry.spend += Number(row.investimento || 0);
    entry.conversions += toPurchaseConversions(row);
  }

  // Reclassifica com spend/conv totais (ajuda fallback comportamental)
  for (const entry of byCampaign.values()) {
    entry.classification = classifyCampaign({
      platform: entry.platform,
      campaignId: entry.campaign_id,
      campaignName: entry.campaign_name,
      objective: entry.objective,
      spend: entry.spend,
      conversions: entry.conversions,
    });
  }

  const byDate = new Map<string, DayAgg>();

  for (const row of campaignRows) {
    const key = `${row.platform}__${row.campaign_id}`;
    const entry = byCampaign.get(key);
    if (!entry) continue;
    const role = entry.classification.role;
    if (!byDate.has(row.date)) byDate.set(row.date, emptyDay());
    const day = byDate.get(row.date)!;

    const inv = Number(row.investimento || 0);
    const alc = Number(row.alcance || 0);
    const freq = Number(row.frequencia || 0);
    const impr = Number(row.impressoes || 0);
    const conv = Number(row.conversoes || 0);
    const rec = Number(row.receita || 0);

    if (role === "topo") {
      day.investimentoTopo += inv;
      day.alcanceTopo += alc;
      day.impressoesTopo += impr;
      if (freq > 0) {
        day.frequenciaTopo += freq;
        day.frequenciaTopoCount += 1;
      }
      day.ctrSum += Number(row.ctr || 0);
      day.cpmSum += Number(row.cpm || 0);
      day.cpcSum += Number(row.cpc || 0);
      day.unique_clicks += Number(row.unique_clicks || 0);
      day.unique_ctrSum += Number(row.unique_ctr || 0);
      day.topoMetricRows += 1;
    } else if (role === "meio") {
      day.investimentoMeio += inv;
      // Meio não entra como pressão de topo nem como conversão de fundo no modelo principal
    } else if (role === "fundo") {
      const purchaseConv = toPurchaseConversions(row);
      day.investimentoFundo += inv;
      day.conversoesFundo += purchaseConv;
      day.receitaFundo += rec;
      if (purchaseConv > 0) {
        day.conv_1d_click += Number(row.conv_1d_click || 0);
        day.conv_7d_click += Number(row.conv_7d_click || 0);
        day.conv_1d_view += Number(row.conv_1d_view || 0);
        day.conv_7d_view += Number(row.conv_7d_view || 0);
      }
    }
    // misto / indefinido: fora da causalidade principal
  }

  const series: FunnelDailyRecord[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const freq =
        d.frequenciaTopoCount > 0 ? d.frequenciaTopo / d.frequenciaTopoCount : 0;
      return {
        date,
        investimentoTopo: d.investimentoTopo,
        investimentoFundo: d.investimentoFundo,
        alcanceTopo: d.alcanceTopo,
        frequenciaTopo: freq,
        impressoesTopo: d.impressoesTopo,
        conversoesFundo: d.conversoesFundo,
        receitaFundo: d.receitaFundo,
        cpaFundo: d.conversoesFundo > 0 ? d.investimentoFundo / d.conversoesFundo : 0,
        roasFundo: d.investimentoFundo > 0 ? d.receitaFundo / d.investimentoFundo : 0,
        indicadorPromocao: 0 as const,
        trendIndex: 0,
      };
    });

  const campaigns: ClassifiedCampaignSummary[] = [...byCampaign.values()]
    .map((c) => ({
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      platform: c.platform,
      objective: c.objective,
      funnel_stage: c.classification.role,
      confidence: c.classification.confidence,
      evidence: c.classification.evidence,
      totalSpend: c.spend,
      totalConversions: c.conversions,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const attribution = {
    conv1dClick: 0,
    conv7dClick: 0,
    conv1dView: 0,
    conv7dView: 0,
  };
  let topoRows = 0;
  let ctrSum = 0;
  let cpmSum = 0;
  let cpcSum = 0;
  let uniqueClicks = 0;
  let uniqueCtrSum = 0;

  for (const d of byDate.values()) {
    attribution.conv1dClick += d.conv_1d_click;
    attribution.conv7dClick += d.conv_7d_click;
    attribution.conv1dView += d.conv_1d_view;
    attribution.conv7dView += d.conv_7d_view;
    topoRows += d.topoMetricRows;
    ctrSum += d.ctrSum;
    cpmSum += d.cpmSum;
    cpcSum += d.cpcSum;
    uniqueClicks += d.unique_clicks;
    uniqueCtrSum += d.unique_ctrSum;
  }

  const clickEfficiency =
    topoRows > 0
      ? {
          avgCtr: ctrSum / topoRows,
          avgCpm: cpmSum / topoRows,
          avgCpc: cpcSum / topoRows,
          totalUniqueClicks: uniqueClicks,
          avgUniqueCtr: uniqueCtrSum / topoRows,
        }
      : null;

  return { series, campaigns, lastSync, attribution, clickEfficiency };
}
