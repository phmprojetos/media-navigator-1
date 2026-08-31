/**
 * ═══════════════════════════════════════════════════════════════
 * ISO — Índice de Saúde da Operação
 * ═══════════════════════════════════════════════════════════════
 *
 * Substitui o antigo MBEI como métrica principal.
 * Escala: 0–100 (quando há dados de campanha)
 *
 * Componentes:
 *   - Entrega de Resultado       (30%)
 *   - Eficiência de Investimento (20%)
 *   - Estabilidade Estrutural    (15%)
 *   - Evolução Temporal          (20%)
 *   - Qualidade Operacional      (15%)
 * ═══════════════════════════════════════════════════════════════
 */

export type ISOClassification = "excelente" | "saudavel" | "atencao" | "critico" | "indisponivel";

export interface ISOScore {
  /** false quando não há campanhas para calcular — não interpretar score/components */
  available: boolean;
  /** Nota final ISO (0–100). Sem dados: 0 (não usar para classificação). */
  score: number;
  classification: ISOClassification;
  classificationLabel: string;
  trend: "up" | "down" | "stable";
  trendDelta: number;

  /** Componentes individuais (0–100 cada). Sem dados: todos 0. */
  components: {
    performance: number;      // Entrega de Resultado (30%)
    efficiency: number;       // Eficiência de Investimento (20%)
    stability: number;        // Estabilidade Estrutural (15%)
    evolution: number;        // Evolução Temporal (20%)
    operational: number;      // Qualidade Operacional (15%)
  };

  /** Resumo da IA sobre o fator principal */
  aiSummary: string;
}

// ── Classification ──

export function classifyISO(score: number): { classification: Exclude<ISOClassification, "indisponivel">; label: string } {
  if (score >= 90) return { classification: "excelente", label: "Excelente" };
  if (score >= 75) return { classification: "saudavel", label: "Saudável" };
  if (score >= 60) return { classification: "atencao", label: "Atenção" };
  return { classification: "critico", label: "Crítico" };
}

// ── Visual meta ──

export const isoClassificationMeta: Record<ISOClassification, { label: string; color: string; bg: string; border: string }> = {
  excelente: { label: "Excelente", color: "text-status-success", bg: "bg-status-success/10", border: "border-status-success/30" },
  saudavel: { label: "Saudável", color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  atencao: { label: "Atenção", color: "text-status-warning", bg: "bg-status-warning/10", border: "border-status-warning/30" },
  critico: { label: "Crítico", color: "text-status-error", bg: "bg-status-error/10", border: "border-status-error/30" },
  indisponivel: { label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border" },
};

export const ISO_COMPONENT_LABELS: Record<keyof ISOScore["components"], { label: string; weight: string }> = {
  performance: { label: "Entrega de Resultado", weight: "30%" },
  efficiency: { label: "Eficiência de Investimento", weight: "20%" },
  stability: { label: "Estabilidade Estrutural", weight: "15%" },
  evolution: { label: "Evolução Temporal", weight: "20%" },
  operational: { label: "Qualidade Operacional", weight: "15%" },
};

export function formatISOScore(iso: ISOScore): string {
  return iso.available ? String(iso.score) : "—";
}
