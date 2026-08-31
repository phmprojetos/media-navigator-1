import type { PlatformCampaignInput, PlatformFunnelAdapter, FunnelSignals } from "../types";

function mapChannel(channel?: string | null): FunnelSignals["channelFamily"] {
  const c = (channel ?? "").toUpperCase();
  if (["VIDEO", "DISPLAY", "DEMAND_GEN", "DISCOVERY"].includes(c)) return c === "VIDEO" ? "video" : "display";
  if (c === "SEARCH" || c === "HOTEL" || c === "LOCAL" || c === "LOCAL_SERVICES") return "search";
  if (c === "SHOPPING") return "shopping";
  if (c === "PERFORMANCE_MAX" || c === "MULTI_CHANNEL" || c === "SMART" || c === "TRAVEL") return "mixed";
  if (c === "SOCIAL") return "social";
  return "other";
}

function mapBidding(bidding?: string | null): FunnelSignals["bidIntent"] {
  const b = (bidding ?? "").toUpperCase();
  if (!b) return "unknown";
  if (b.includes("IMPRESSION") || b.includes("VIEWABLE") || b.includes("CPM")) return "reach";
  if (b.includes("CLICK") || b.includes("TRAFFIC")) return "traffic";
  if (b.includes("CONVERSION_VALUE") || b.includes("ROAS") || b.includes("VALUE")) return "value";
  if (b.includes("CONVERSION") || b.includes("CPA") || b.includes("TARGET_CPA")) return "conversions";
  return "unknown";
}

export const googleAdsAdapter: PlatformFunnelAdapter = {
  platform: "google_ads",
  normalize(input: PlatformCampaignInput): FunnelSignals {
    // No banco legado, `objective` guarda advertising_channel_type
    const channel = input.channelType ?? input.objective;
    return {
      platform: "google_ads",
      campaignName: input.campaignName,
      rawObjective: channel,
      channelFamily: mapChannel(channel),
      bidIntent: mapBidding(input.biddingStrategy),
      conversionGoalCategories: input.conversionGoalCategories ?? undefined,
      campaignGoalType: input.campaignGoalType,
      spend: input.spend,
      conversions: input.conversions,
    };
  },
};
