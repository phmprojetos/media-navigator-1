import type { PlatformCampaignInput, PlatformFunnelAdapter, FunnelSignals } from "../types";

/**
 * Stubs escaláveis — copiar este padrão ao adicionar TikTok / Kwai / LinkedIn.
 * Enquanto `objective`/goals nativos não forem sincronizados, caem no generic via registry
 * OU usam estes adapters com os campos que já existirem.
 *
 * Para ativar de verdade: enriquecer o sync e preencher intents abaixo.
 */

function stubNormalize(
  platform: string,
  input: PlatformCampaignInput
): FunnelSignals {
  return {
    platform,
    campaignName: input.campaignName,
    rawObjective: input.objective,
    spend: input.spend,
    conversions: input.conversions,
    // Quando o sync trouxer objective nativo, mapear aqui para intents:
    // awarenessIntent / considerationIntent / conversionIntent
  };
}

export const tiktokAdsAdapter: PlatformFunnelAdapter = {
  platform: "tiktok_ads",
  normalize: (input) => stubNormalize("tiktok_ads", input),
};

export const kwaiAdsAdapter: PlatformFunnelAdapter = {
  platform: "kwai_ads",
  normalize: (input) => stubNormalize("kwai_ads", input),
};

export const linkedinAdsAdapter: PlatformFunnelAdapter = {
  platform: "linkedin_ads",
  normalize: (input) => stubNormalize("linkedin_ads", input),
};
