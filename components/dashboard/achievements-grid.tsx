"use client";

import { useMemo, useState } from "react";
import { Award, Lock } from "lucide-react";
import { buildAchievements } from "@/lib/achievements";
import type { ReportRow } from "@/lib/reports";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<string, string> = {
  bronze: "from-amber-deep/70 to-amber/70",
  silver: "from-muted-foreground/70 to-foreground/50",
  gold: "from-amber to-amber-deep",
};

export function AchievementsGrid({
  rows,
  daysOnRank,
  modXp,
}: {
  rows: ReportRow[];
  daysOnRank: number | null;
  modXp: number;
}) {
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(
    () => buildAchievements(rows, { daysOnRank, modXp }),
    [rows, daysOnRank, modXp],
  );
  const earned = list.filter((a) => a.earned);
  const visible = showAll ? list : list.slice(0, 8);

  return (
    <div className="bg-card rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Award className="text-amber-deep size-[18px]" />
          <h3 className="font-display text-sm font-semibold">
            Получено {earned.length} из {list.length}
          </h3>
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
        >
          {showAll ? "Свернуть" : "Показать все"}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {visible.map((a) => (
          <li
            key={a.id}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-opacity",
              a.earned ? "border-amber/40 bg-amber/5" : "opacity-70",
            )}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full bg-linear-to-br text-primary-foreground",
                a.earned ? TIER_STYLES[a.tier] : "from-secondary to-secondary",
              )}
            >
              {a.earned ? (
                <Award className="size-5" />
              ) : (
                <Lock className="text-muted-foreground size-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{a.title}</p>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px] leading-tight">
                {a.desc}
              </p>
            </div>
            {!a.earned && (
              <div className="w-full">
                <div className="bg-secondary h-1 overflow-hidden rounded-full">
                  <span
                    className="from-green to-green-bright block h-full rounded-full bg-linear-to-r"
                    style={{ width: `${Math.round(a.progress * 100)}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-[10px] font-semibold">{a.label}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
