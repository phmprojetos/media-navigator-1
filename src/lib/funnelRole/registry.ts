import type { FunnelClassification, PlatformCampaignInput, PlatformFunnelAdapter } from "./types";
import { classifyFromSignals } from "./core";

const adapters = new Map<string, PlatformFunnelAdapter>();

/** Registra (ou substitui) um adapter de plataforma. */
export function registerFunnelAdapter(adapter: PlatformFunnelAdapter): void {
  adapters.set(adapter.platform, adapter);
}

export function getFunnelAdapter(platform: string): PlatformFunnelAdapter | undefined {
  return adapters.get(platform);
}

export function listFunnelAdapters(): string[] {
  return [...adapters.keys()];
}

/**
 * Ponto único de entrada: resolve adapter pela plataforma.
 * Plataformas desconhecidas usam o adapter `generic` (se registrado).
 */
export function classifyCampaign(input: PlatformCampaignInput): FunnelClassification {
  const adapter =
    adapters.get(input.platform) ??
    adapters.get("generic");

  if (!adapter) {
    return {
      role: "indefinido",
      confidence: "baixa",
      evidence: [`no_adapter_for=${input.platform}`],
      signals: { platform: input.platform, campaignName: input.campaignName },
    };
  }

  const signals = adapter.normalize(input);
  return classifyFromSignals(signals);
}
