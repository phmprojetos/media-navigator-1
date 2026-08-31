import type {
  FunnelClassification,
  FunnelConfidence,
  FunnelRole,
  FunnelSignals,
} from "./types";

function pushEvidence(evidence: string[], msg: string) {
  if (!evidence.includes(msg)) evidence.push(msg);
}

/**
 * Classifica a partir de sinais já normalizados.
 * Independente de plataforma — novos adapters não alteram este arquivo.
 */
export function classifyFromSignals(signals: FunnelSignals): FunnelClassification {
  const evidence: string[] = [];

  // ── App promotion explícito ──
  if (signals.appPromotion) {
    if (signals.appPromotion.kind === "install") {
      pushEvidence(evidence, "appPromotion=install");
      return finish("meio", "alta", evidence, signals);
    }
    if (signals.appPromotion.kind === "in_app_sales") {
      pushEvidence(evidence, "appPromotion=in_app_sales");
      return finish("fundo", "alta", evidence, signals);
    }
    pushEvidence(evidence, "appPromotion=unknown");
    // continua — pode haver outros sinais
  }

  // ── Intents diretos (maior prioridade) ──
  const intentHits: FunnelRole[] = [];
  if (signals.awarenessIntent) {
    intentHits.push("topo");
    pushEvidence(evidence, "awarenessIntent");
  }
  if (signals.considerationIntent) {
    intentHits.push("meio");
    pushEvidence(evidence, "considerationIntent");
  }
  if (signals.conversionIntent) {
    intentHits.push("fundo");
    pushEvidence(evidence, "conversionIntent");
  }

  if (intentHits.length === 1) {
    return finish(intentHits[0], "alta", evidence, signals);
  }
  if (intentHits.length > 1) {
    // Conversão vence awareness/consideração quando ambos presentes no mesmo asset
    if (intentHits.includes("fundo") && !intentHits.includes("topo")) {
      return finish("fundo", "media", evidence, signals);
    }
    if (intentHits.includes("topo") && intentHits.includes("fundo")) {
      return finish("misto", "baixa", evidence, signals);
    }
    if (intentHits.includes("meio") && intentHits.includes("fundo")) {
      return finish("fundo", "media", evidence, signals);
    }
    return finish("misto", "baixa", evidence, signals);
  }

  // ── Conversion goal categories (Google-like) ──
  const goals = (signals.conversionGoalCategories ?? []).map((g) => g.toUpperCase());
  if (goals.length > 0) {
    const sales = goals.some((g) =>
      ["PURCHASE", "ADD_TO_CART", "BEGIN_CHECKOUT", "ADD_PAYMENT_INFO", "SUBSCRIBE"].includes(g)
    );
    const leads = goals.some((g) =>
      ["LEAD", "SIGNUP", "SUBMIT_LEAD_FORM", "CONTACT", "BOOK_APPOINTMENT"].includes(g)
    );
    const engage = goals.some((g) =>
      ["PAGE_VIEW", "ENGAGEMENT", "VIDEO_VIEW"].includes(g)
    );
    if (sales) {
      pushEvidence(evidence, `conversionGoals=${goals.join(",")}`);
      return finish("fundo", "alta", evidence, signals);
    }
    if (leads || engage) {
      pushEvidence(evidence, `conversionGoals=${goals.join(",")}`);
      return finish("meio", "media", evidence, signals);
    }
  }

  // ── Campaign goal type (DV360-like) ──
  const goalType = (signals.campaignGoalType ?? "").toUpperCase();
  if (goalType.includes("BRAND_AWARENESS")) {
    pushEvidence(evidence, `campaignGoalType=${goalType}`);
    return finish("topo", "alta", evidence, signals);
  }
  if (goalType.includes("ONLINE_ACTION") || goalType.includes("OFFLINE_ACTION") || goalType.includes("APP_INSTALL")) {
    pushEvidence(evidence, `campaignGoalType=${goalType}`);
    // APP_INSTALL no DV360 ≈ aquisição → meio; actions ≈ fundo
    if (goalType.includes("APP_INSTALL")) return finish("meio", "media", evidence, signals);
    return finish("fundo", "alta", evidence, signals);
  }

  const perf = (signals.performanceGoalType ?? "").toUpperCase();
  if (perf.includes("CPM") || perf.includes("VIEWABILITY") || perf.includes("CPV") || perf.includes("CPIAVC")) {
    pushEvidence(evidence, `performanceGoal=${perf}`);
    return finish("topo", "media", evidence, signals);
  }
  if (perf.includes("CPA")) {
    pushEvidence(evidence, `performanceGoal=${perf}`);
    return finish("fundo", "media", evidence, signals);
  }
  if (perf.includes("CPC")) {
    pushEvidence(evidence, `performanceGoal=${perf}`);
    return finish("meio", "media", evidence, signals);
  }

  // ── Bid intent ──
  if (signals.bidIntent === "value" || signals.bidIntent === "conversions") {
    pushEvidence(evidence, `bidIntent=${signals.bidIntent}`);
    return finish("fundo", "media", evidence, signals);
  }
  if (signals.bidIntent === "reach") {
    pushEvidence(evidence, "bidIntent=reach");
    return finish("topo", "media", evidence, signals);
  }
  if (signals.bidIntent === "traffic") {
    pushEvidence(evidence, "bidIntent=traffic");
    return finish("meio", "media", evidence, signals);
  }

  // ── Channel family proxy ──
  if (signals.channelFamily === "video" || signals.channelFamily === "display") {
    pushEvidence(evidence, `channelFamily=${signals.channelFamily}`);
    return finish("topo", "baixa", evidence, signals);
  }
  if (signals.channelFamily === "search" || signals.channelFamily === "shopping") {
    pushEvidence(evidence, `channelFamily=${signals.channelFamily}`);
    return finish("fundo", "baixa", evidence, signals);
  }
  if (signals.channelFamily === "social") {
    pushEvidence(evidence, "channelFamily=social");
    return finish("meio", "baixa", evidence, signals);
  }
  if (signals.channelFamily === "mixed") {
    pushEvidence(evidence, "channelFamily=mixed");
    return finish("misto", "baixa", evidence, signals);
  }

  // ── Taxonomia no nome (desempate) ──
  const nameRole = inferRoleFromName(signals.campaignName);
  if (nameRole) {
    pushEvidence(evidence, `nameHint=${nameRole}`);
    return finish(nameRole, "baixa", evidence, signals);
  }

  // ── Comportamento ──
  const spend = signals.spend ?? 0;
  const conv = signals.conversions ?? 0;
  if (spend > 0 && conv === 0) {
    pushEvidence(evidence, "behavior=spend_without_conversions");
    return finish("topo", "baixa", evidence, signals);
  }
  if (spend > 0 && conv > 0) {
    pushEvidence(evidence, "behavior=spend_with_conversions");
    return finish("fundo", "baixa", evidence, signals);
  }

  pushEvidence(evidence, "fallback=indefinido");
  return finish("indefinido", "baixa", evidence, signals);
}

function inferRoleFromName(name?: string | null): FunnelRole | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/\b(top|tofu|awareness|alcance|brand)\b/.test(n) || n.includes(" - top") || n.includes("_top")) {
    return "topo";
  }
  if (/\b(mid|mofu|meio|traffic|formular|engaj)\b/.test(n) || n.includes(" - mid") || n.includes("_mid")) {
    return "meio";
  }
  if (/\b(bot|bottom|bofu|fundo|convers|sales|purchase)\b/.test(n) || n.includes(" - bot") || n.includes("_bot")) {
    return "fundo";
  }
  return null;
}

function finish(
  role: FunnelRole,
  confidence: FunnelConfidence,
  evidence: string[],
  signals: FunnelSignals
): FunnelClassification {
  return { role, confidence, evidence, signals };
}
