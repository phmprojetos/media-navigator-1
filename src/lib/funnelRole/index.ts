/**
 * Funnel Role Engine
 * ──────────────────
 * Motor escalável de classificação topo/meio/fundo multiplataforma.
 *
 * Nova integração (ex.: TikTok):
 *   1. Criar adapter em adapters/ que implementa PlatformFunnelAdapter
 *   2. registerFunnelAdapter(...) em bootstrap.ts
 *   3. (Opcional) enriquecer o sync com objective/goals nativos
 *
 * O core (classifyFromSignals) NÃO deve ganhar if/else por plataforma.
 */

export type {
  FunnelRole,
  FunnelConfidence,
  FunnelSignals,
  FunnelClassification,
  PlatformCampaignInput,
  PlatformFunnelAdapter,
} from "./types";

export { classifyFromSignals } from "./core";
export {
  registerFunnelAdapter,
  getFunnelAdapter,
  listFunnelAdapters,
  classifyCampaign,
} from "./registry";
export { bootstrapFunnelRoleEngine } from "./bootstrap";
export {
  buildClientFunnelFromCampaignRows,
  toPurchaseConversions,
  type FunnelMetricRow,
  type ClassifiedCampaignSummary,
} from "./aggregateClientFunnel";

import { bootstrapFunnelRoleEngine } from "./bootstrap";
bootstrapFunnelRoleEngine();
