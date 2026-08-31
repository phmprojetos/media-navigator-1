/**
 * Classificador de funil compartilhado pelos syncs (Deno).
 * Espelha as regras do motor frontend (src/lib/funnelRole) para Meta objective.
 * Ao adicionar plataforma no sync, preferir mapear → topo|meio|fundo aqui
 * sem acoplar a UI.
 */

export type SyncFunnelStage = "topo" | "meio" | "fundo";

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
];

const SALES_EVENTS = new Set([
  "PURCHASE",
  "SUBSCRIBE",
  "START_TRIAL",
  "INITIATED_CHECKOUT",
  "ADD_TO_CART",
  "ADD_PAYMENT_INFO",
]);

/** Meta: objective (+ opcional optimization_goal / custom_event_type). */
export function classifyMetaObjective(
  objective: string,
  optimizationGoal?: string | null,
  customEventType?: string | null
): SyncFunnelStage {
  const upper = (objective ?? "").toUpperCase();

  if (upper.includes("OUTCOME_APP_PROMOTION") || upper === "APP_INSTALLS") {
    const goal = (optimizationGoal ?? "").toUpperCase();
    const event = (customEventType ?? "").toUpperCase();
    if (goal === "VALUE" || SALES_EVENTS.has(event)) return "fundo";
    if (
      (goal === "OFFSITE_CONVERSIONS" || goal === "APP_INSTALLS_AND_OFFSITE_CONVERSIONS") &&
      SALES_EVENTS.has(event)
    ) {
      return "fundo";
    }
    if (goal === "APP_INSTALLS") return "meio";
    // Sem ad set: default conservador = meio (aquisição), sync pode reclassificar depois
    return "meio";
  }

  if (AWARENESS.some((o) => upper.includes(o))) return "topo";
  if (CONSIDERATION.some((o) => upper.includes(o))) return "meio";
  if (CONVERSION.some((o) => upper.includes(o))) return "fundo";
  return "fundo";
}

/** Google Ads: channel type (+ futuro: bidding / conversion goals). */
export function classifyGoogleChannel(channelType: string): SyncFunnelStage {
  const upper = (channelType ?? "").toUpperCase();
  if (["DISPLAY", "VIDEO", "DEMAND_GEN", "DISCOVERY", "SOCIAL"].includes(upper)) return "topo";
  if (["MULTI_CHANNEL", "LOCAL_SERVICES", "PERFORMANCE_MAX"].includes(upper)) return "meio";
  return "fundo";
}
