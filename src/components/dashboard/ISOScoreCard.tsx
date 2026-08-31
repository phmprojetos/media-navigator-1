import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import type { ISOScore } from "@/types/iso";
import { isoClassificationMeta, ISO_COMPONENT_LABELS, formatISOScore } from "@/types/iso";

interface ISOScoreCardProps {
  iso: ISOScore;
}

export function ISOScoreCard({ iso }: ISOScoreCardProps) {
  const meta = isoClassificationMeta[iso.classification];
  const TrendIcon = iso.trend === "up" ? TrendingUp : iso.trend === "down" ? TrendingDown : Minus;

  return (
    <div className="relative p-6 rounded-xl bg-card border border-border overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">ISO</h3>
              <p className="text-xs text-muted-foreground">Índice de Saúde da Operação</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {iso.available && <TrendIcon className={cn("w-4 h-4", meta.color)} />}
            <span className={cn("text-xs font-medium px-3 py-1 rounded-full border", meta.bg, meta.color, meta.border)}>
              {iso.classificationLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-5xl font-bold tabular-nums", meta.color)}>{formatISOScore(iso)}</span>
            {iso.available && <span className="text-lg text-muted-foreground">/100</span>}
          </div>
          {iso.available && (
            <div className="flex-1">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", meta.bg.replace("/10", ""))}
                  style={{ width: `${iso.score}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-muted/40 border border-border/40 mb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{iso.aiSummary}</p>
        </div>

        {iso.available && (
          <div className="grid grid-cols-5 gap-3">
            {(Object.entries(iso.components) as [keyof typeof iso.components, number][]).map(([key, value]) => {
              const comp = ISO_COMPONENT_LABELS[key];
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground truncate">{comp.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">{comp.weight}</span>
                  </div>
                  <Progress value={value} className="h-1.5" />
                  <span className={cn("text-xs font-bold", value >= 75 ? "text-status-success" : value >= 60 ? "text-status-warning" : "text-status-error")}>{value}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
