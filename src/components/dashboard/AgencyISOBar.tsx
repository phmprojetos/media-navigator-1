import { cn } from "@/lib/utils";
import type { AgencyAggregation } from "@/types/efficiency";
import type { ISOScore } from "@/types/iso";
import { isoClassificationMeta, formatISOScore } from "@/types/iso";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";

interface AgencyISOBarProps {
  data: AgencyAggregation;
  iso: ISOScore;
}

export function AgencyISOBar({ data, iso }: AgencyISOBarProps) {
  const meta = isoClassificationMeta[iso.classification];

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", meta.bg)}>
            <Activity className={cn("w-5 h-5", meta.color)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ISO</p>
            <p className={cn("text-xl font-bold tabular-nums", meta.color)}>
              {formatISOScore(iso)}
              {iso.available && <span className="text-sm text-muted-foreground">/100</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", meta.bg)}>
            <span className={cn("text-lg font-bold", meta.color)}>
              {iso.available ? (iso.trend === "up" ? "↑" : iso.trend === "down" ? "↓" : "→") : "—"}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Classificação</p>
            <p className={cn("text-sm font-semibold", meta.color)}>{iso.classificationLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-status-error/10">
            <TrendingUp className="w-5 h-5 text-status-error" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overspending</p>
            <p className="text-xl font-bold text-foreground tabular-nums">
              {data.overspendingCount}
              <span className="text-sm text-muted-foreground"> / {data.totalCampaigns}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-status-warning/10">
            <TrendingDown className="w-5 h-5 text-status-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Underspending</p>
            <p className="text-xl font-bold text-foreground tabular-nums">
              {data.underspendingCount}
              <span className="text-sm text-muted-foreground"> / {data.totalCampaigns}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
