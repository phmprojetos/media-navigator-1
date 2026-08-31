/**
 * Funnel Role Engine — tipos canônicos.
 *
 * Qualquer plataforma nova (TikTok, Kwai, LinkedIn…) só precisa:
 * 1. Implementar um PlatformFunnelAdapter
 * 2. Registrar no registry
 *
 * O core classifica apenas sinais normalizados — nunca if/else por plataforma.
 */

export type FunnelRole = "topo" | "meio" | "fundo" | "misto" | "indefinido";
export type FunnelConfidence = "alta" | "media" | "baixa";

/** Sinais normalizados — preenchidos pelos adapters de cada integração. */
export interface FunnelSignals {
  platform: string;
  campaignName?: string | null;
  /** Objective / goal bruto (evidência). */
  rawObjective?: string | null;
  /** Intenção de awareness / reach / brand. */
  awarenessIntent?: boolean;
  /** Tráfego, engajamento, leads, app install. */
  considerationIntent?: boolean;
  /** Vendas / purchase / valor. */
  conversionIntent?: boolean;
  /** Detalhe específico de app promotion (Meta e similares). */
  appPromotion?: {
    kind: "install" | "in_app_sales" | "unknown";
  };
  channelFamily?: "video" | "display" | "search" | "social" | "shopping" | "mixed" | "other";
  bidIntent?: "reach" | "traffic" | "conversions" | "value" | "unknown";
  conversionGoalCategories?: string[];
  campaignGoalType?: string | null;
  performanceGoalType?: string | null;
  /** Fallback comportamental. */
  spend?: number;
  conversions?: number;
}

export interface FunnelClassification {
  role: FunnelRole;
  confidence: FunnelConfidence;
  evidence: string[];
  signals: FunnelSignals;
}

/**
 * Input bruto genérico. Cada adapter lê só o que conhece.
 * Campos extras de novas plataformas entram em `extras` sem quebrar o core.
 */
export interface PlatformCampaignInput {
  platform: string;
  campaignId?: string | null;
  campaignName?: string | null;
  /** Campo legado `objective` no banco (Meta objective | Google channel | DV360 line item). */
  objective?: string | null;
  /** Sinais ricos opcionais — preenchidos quando o sync enriquecer. */
  optimizationGoal?: string | null;
  customEventType?: string | null;
  biddingStrategy?: string | null;
  conversionGoalCategories?: string[] | null;
  campaignGoalType?: string | null;
  performanceGoalType?: string | null;
  lineItemType?: string | null;
  channelType?: string | null;
  spend?: number;
  conversions?: number;
  extras?: Record<string, unknown>;
}

export interface PlatformFunnelAdapter {
  /** id estável: meta_ads, google_ads, dv360, tiktok_ads… */
  platform: string;
  normalize(input: PlatformCampaignInput): FunnelSignals;
}
