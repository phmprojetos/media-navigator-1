import type { PlatformCampaignInput, PlatformFunnelAdapter, FunnelSignals } from "../types";

function mapLineItem(lineItem?: string | null): FunnelSignals["channelFamily"] {
  const t = (lineItem ?? "").toLowerCase();
  if (t.includes("video") || t.includes("youtube")) return "video";
  if (t.includes("audio")) return "other";
  if (t.includes("demand gen")) return "social";
  if (t.includes("real-time bidding") || t.includes("display")) return "display";
  return "other";
}

export const dv360Adapter: PlatformFunnelAdapter = {
  platform: "dv360",
  normalize(input: PlatformCampaignInput): FunnelSignals {
    // Legado: objective = lineItemType do Bid Manager
    const lineItem = input.lineItemType ?? input.objective;
    return {
      platform: "dv360",
      campaignName: input.campaignName,
      rawObjective: lineItem,
      campaignGoalType: input.campaignGoalType,
      performanceGoalType: input.performanceGoalType,
      channelFamily: input.campaignGoalType ? undefined : mapLineItem(lineItem),
      spend: input.spend,
      conversions: input.conversions,
    };
  },
};
