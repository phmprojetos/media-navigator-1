import type { CampaignTrendData } from "@/types/efficiency";

export interface ClientData {
  id: string;
  name: string;
}

export interface CampaignWithClient extends CampaignTrendData {
  clientId: string;
  clientName: string;
  accountId?: string;
  status: "active" | "paused";
  /** Last 30d spend from synced funnel rows. */
  spend?: number;
  conversions?: number;
  impressions?: number;
}

export interface CreativeWithClient {
  id: string;
  clientId: string;
  clientName: string;
  platform: string;
  campaignName: string;
  name: string;
  format: string;
  angle: string;
  emotion: string;
  offer: string;
  cta: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  cpa: number;
  mbei: number;
  momentum: string;
  status: "scaling" | "stable" | "saturating" | "testing";
}

/** Known DSP labels for filters when no campaign data is loaded yet. */
export const PLATFORMS = ["Google Ads", "Meta Ads", "DV360", "LinkedIn", "TikTok Ads"];

/** Campaign metrics are loaded from integrations — no seeded demo data. */
export const ALL_CAMPAIGNS: CampaignWithClient[] = [];

/** Creative performance metrics — populated when creatives sync is available. */
export const ALL_CREATIVES: CreativeWithClient[] = [];

export function getClientsFromCampaigns(campaigns: CampaignWithClient[]): ClientData[] {
  const map = new Map<string, ClientData>();
  campaigns.forEach((c) => map.set(c.clientId, { id: c.clientId, name: c.clientName }));
  return Array.from(map.values());
}

export function getPlatformsFromCampaigns(campaigns: CampaignWithClient[]): string[] {
  return [...new Set(campaigns.map((c) => c.platform))];
}
