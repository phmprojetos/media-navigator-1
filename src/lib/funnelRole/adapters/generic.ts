import type { PlatformCampaignInput, PlatformFunnelAdapter, FunnelSignals } from "../types";

/**
 * Adapter genérico para qualquer plataforma ainda sem normalizer dedicado
 * (TikTok, Kwai, LinkedIn, etc. até registrarem o próprio).
 * Usa nome + comportamento — confiança baixa de propósito.
 */
export const genericAdapter: PlatformFunnelAdapter = {
  platform: "generic",
  normalize(input: PlatformCampaignInput): FunnelSignals {
    return {
      platform: input.platform || "generic",
      campaignName: input.campaignName,
      rawObjective: input.objective,
      spend: input.spend,
      conversions: input.conversions,
      conversionGoalCategories: input.conversionGoalCategories ?? undefined,
      campaignGoalType: input.campaignGoalType,
      performanceGoalType: input.performanceGoalType,
    };
  },
};
