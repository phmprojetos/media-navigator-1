import type { PlatformCampaignInput, PlatformFunnelAdapter, FunnelSignals } from "../types";

const AWARENESS = [
  "OUTCOME_AWARENESS",
  "BRAND_AWARENESS",
  "REACH",
  "AWARENESS",
  "VIDEO_VIEWS",
];

const CONSIDERATION = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "TRAFFIC",
  "ENGAGEMENT",
  "POST_ENGAGEMENT",
  "PAGE_LIKES",
  "LINK_CLICKS",
  "EVENT_RESPONSES",
  "MESSAGES",
];

const CONVERSION = [
  "OUTCOME_SALES",
  "CONVERSIONS",
  "PRODUCT_CATALOG_SALES",
  "STORE_TRAFFIC",
];

const SALES_EVENTS = new Set([
  "PURCHASE",
  "SUBSCRIBE",
  "START_TRIAL",
  "INITIATED_CHECKOUT",
  "ADD_TO_CART",
  "ADD_PAYMENT_INFO",
]);

function resolveAppPromotion(
  optimizationGoal?: string | null,
  customEventType?: string | null
): FunnelSignals["appPromotion"] {
  const goal = (optimizationGoal ?? "").toUpperCase();
  const event = (customEventType ?? "").toUpperCase();

  if (goal === "VALUE" || SALES_EVENTS.has(event)) {
    return { kind: "in_app_sales" };
  }
  if (
    (goal === "OFFSITE_CONVERSIONS" || goal === "APP_INSTALLS_AND_OFFSITE_CONVERSIONS") &&
    SALES_EVENTS.has(event)
  ) {
    return { kind: "in_app_sales" };
  }
  if (goal === "APP_INSTALLS") {
    return { kind: "install" };
  }
  // Sem ad set enriquecido → unknown (core marca misto/indefinido com baixa confiança)
  return { kind: "unknown" };
}

export const metaAdsAdapter: PlatformFunnelAdapter = {
  platform: "meta_ads",
  normalize(input: PlatformCampaignInput): FunnelSignals {
    const objective = (input.objective ?? "").toUpperCase();
    const signals: FunnelSignals = {
      platform: "meta_ads",
      campaignName: input.campaignName,
      rawObjective: input.objective,
      spend: input.spend,
      conversions: input.conversions,
    };

    if (objective.includes("OUTCOME_APP_PROMOTION") || objective === "APP_INSTALLS") {
      signals.appPromotion = resolveAppPromotion(input.optimizationGoal, input.customEventType);
      return signals;
    }

    if (AWARENESS.some((o) => objective.includes(o))) {
      signals.awarenessIntent = true;
    }
    if (CONSIDERATION.some((o) => objective.includes(o))) {
      signals.considerationIntent = true;
    }
    if (CONVERSION.some((o) => objective.includes(o))) {
      signals.conversionIntent = true;
    }

    return signals;
  },
};
