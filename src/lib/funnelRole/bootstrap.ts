import { registerFunnelAdapter } from "./registry";
import { metaAdsAdapter } from "./adapters/metaAds";
import { googleAdsAdapter } from "./adapters/googleAds";
import { dv360Adapter } from "./adapters/dv360";
import { genericAdapter } from "./adapters/generic";
import {
  tiktokAdsAdapter,
  kwaiAdsAdapter,
  linkedinAdsAdapter,
} from "./adapters/futurePlatforms";

let bootstrapped = false;

/** Idempotente — registra todos os adapters conhecidos. */
export function bootstrapFunnelRoleEngine(): void {
  if (bootstrapped) return;
  registerFunnelAdapter(metaAdsAdapter);
  registerFunnelAdapter(googleAdsAdapter);
  registerFunnelAdapter(dv360Adapter);
  registerFunnelAdapter(genericAdapter);
  // Prontos para ativar quando o sync existir — usam stub até enriquecer sinais
  registerFunnelAdapter(tiktokAdsAdapter);
  registerFunnelAdapter(kwaiAdsAdapter);
  registerFunnelAdapter(linkedinAdsAdapter);
  bootstrapped = true;
}
