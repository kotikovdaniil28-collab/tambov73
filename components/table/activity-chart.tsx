"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

type DayInfo = { key: string; label: string; weekday: string; isToday: boolean };
type ReportLite = { dayKey: string; xp: number };

type Props = {
  days: DayInfo[];
  reports: ReportLite[];
};

type Point = {
  name: string;
  reports: number;
  xp: number;
  isToday: boolean;
};

// Кастомный тултип в стиле карточек сайта
function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="border-border bg-popover rounded-xl border px-3.5 py-2.5 text-xs shadow-lg">
      <p className="mb-1 font-bold">{label}</p>
      <p className="text-muted-foreground">
        Отчётов: <span className="text-foreground font-semibold tabular-nums">{p.reports}</span>
      </p>
      <p className="text-muted-foreground">
        XP: <span className="text-green-deep font-semibold tabular-nums">{p.xp}</span>
      </p>
    </div>
  );
}

/** График «Активность»: столбцы — отчёты за день, линия — заработанный XP */
export function ActivityChart({ days, reports }: Props) {
  const data = useMemo<Point[]>(() => {
    const byDay = new Map<string, { reports: number; xp: number }>();
    for (const d of days) byDay.set(d.key, { reports: 0, xp: 0 });
    for (const r of reports) {
      const bucket = byDay.get(r.dayKey);
      if (!bucket) continue;
      bucket.reports += 1;
      bucket.xp += r.xp;
    }
    return days.map((d) => ({
      name: `${d.weekday} ${d.label}`,
      reports: byDay.get(d.key)?.reports || 0,
      xp: byDay.get(d.key)?.xp || 0,
      isToday: d.isToday,
    }));
  }, [days, reports]);

  const empty = data.every((p) => p.reports === 0);

  return (
    <div className="bg-card rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
          <BarChart3 className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold">Активность</h2>
          <p className="text-muted-foreground text-xs">отчёты и XP команды по дням недели</p>
        </div>
        <div className="text-muted-foreground ml-auto hidden items-center gap-4 text-[11px] font-semibold sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="bg-green-deep size-2.5 rounded-sm" /> отчёты
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-amber size-2.5 rounded-full" /> XP
          </span>
        </div>
      </div>
      {empty ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          За эту неделю отчётов не было
        </p>
      ) : (
        <div className="h-56 w-full" aria-label="График активности команды по дням недели" role="img">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="reports"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis yAxisId="xp" orientation="right" hide />
              <ChartTooltip content={<ActivityTooltip />} cursor={{ fill: "var(--secondary)", opacity: 0.5 }} />
              <Bar
                yAxisId="reports"
                dataKey="reports"
                fill="var(--green-deep, #16a34a)"
                radius={[6, 6, 0, 0]}
                maxBarSize={44}
              />
              <Line
                yAxisId="xp"
                type="monotone"
                dataKey="xp"
                stroke="var(--amber, #f59e0b)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "var(--amber, #f59e0b)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
