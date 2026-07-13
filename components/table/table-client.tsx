"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Table2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Rows3,
  Crown,
  Flame,
  Check,
  Clock3,
  X,
  Minus,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { KV_EMAILS } from "@/lib/constants";
import { parseReportPayload, reportDayMs, type ReportRow } from "@/lib/reports";
import { Reveal } from "@/components/ui/reveal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ActivityChart } from "@/components/table/activity-chart";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  nick: string;
  day: string;
  dayMs: number;
  work: string;
  status: string;
  xp: number;
  email: string;
};

type SortKey = "day" | "nick" | "status" | "xp";
type SortDir = "asc" | "desc";
type ViewMode = "matrix" | "list";

const COLUMNS: { key: SortKey | "work"; label: string; sortable: boolean; className?: string }[] = [
  { key: "day", label: "Дата", sortable: true, className: "w-32" },
  { key: "nick", label: "Ник", sortable: true, className: "w-44" },
  { key: "work", label: "Работа", sortable: false },
  { key: "status", label: "Статус", sortable: true, className: "w-36" },
  { key: "xp", label: "XP", sortable: true, className: "w-20 text-right" },
];

const DAY_MS = 86400000;

// Ключ дня в МСК (YYYY-MM-DD)
function mskDayKey(ms: number): string {
  return new Date(ms + 3 * 3600000).toISOString().slice(0, 10);
}

// Состояние ячейки матрицы, от лучшего к худшему
type CellKind = "hero" | "over" | "ok" | "pending" | "rejected" | "none" | "future";

const CELL_RANK: Record<string, number> = { hero: 5, over: 4, ok: 3, pending: 2, rejected: 1 };

function cellKindOf(r: Row): CellKind {
  const pending = r.status === "pending" || r.status === "На проверке";
  if (pending) return "pending";
  if (r.status === "Герой дня") return "hero";
  if (r.status === "Перенорма") return "over";
  if (r.xp > 0) return "ok";
  return "rejected";
}

const CELL_STYLE: Record<CellKind, { label: string; chip: string; icon: typeof Check }> = {
  hero: {
    label: "Герой дня",
    chip: "bg-amber/15 text-amber-deep border-amber/40",
    icon: Crown,
  },
  over: {
    label: "Перенорма",
    chip: "bg-primary/12 text-primary border-primary/35",
    icon: Flame,
  },
  ok: {
    label: "Одобрено",
    chip: "bg-green-deep/12 text-green-deep border-green-deep/30",
    icon: Check,
  },
  pending: {
    label: "На проверке",
    chip: "bg-secondary text-muted-foreground border-border",
    icon: Clock3,
  },
  rejected: {
    label: "Отклонено",
    chip: "bg-destructive/10 text-destructive border-destructive/30",
    icon: X,
  },
  none: {
    label: "Нет отчёта",
    chip: "bg-transparent text-muted-foreground/50 border-border/50 border-dashed",
    icon: Minus,
  },
  future: {
    label: "",
    chip: "bg-transparent text-transparent border-transparent",
    icon: Minus,
  },
};

export function TableClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<ViewMode>("matrix");
  // Смещение окна матрицы в неделях: 0 = текущие 7 дней
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supa = getSupabase();
      // В таблице reports нет created_at — сортируем на клиенте по дате отчёта
      const { data, error } = await supa.from("reports").select("*").limit(1500);
      if (error) console.error("[table] load error:", error.message);
      if (!mounted) return;
      const mapped: Row[] = ((data || []) as ReportRow[])
        // Служебные записи (SITE_SETTINGS, ключи KV и т.п.) — не отчёты: у них нет "@" в email
        .filter((r) => !KV_EMAILS.has(String(r.email)) && String(r.email || "").includes("@"))
        .map((r) => {
          const p = parseReportPayload(r);
          return {
            id: r.id,
            nick: p.nick,
            day: p.day,
            dayMs: reportDayMs(r),
            work: p.work,
            status: String(r.status || "На проверке"),
            xp: Number(r.xp) || 0,
            email: String(r.email || ""),
          };
        });
      setRows(mapped);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nick" || key === "status" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      const pending = r.status === "pending" || r.status === "На проверке";
      if (statusFilter === "approved" && r.xp <= 0) return false;
      if (statusFilter === "pending" && !pending) return false;
      if (statusFilter === "rejected" && !(r.xp <= 0 && !pending)) return false;
      if (q && !r.nick.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "day") return (a.dayMs - b.dayMs) * dir;
      if (sortKey === "xp") return (a.xp - b.xp) * dir;
      return a[sortKey].localeCompare(b[sortKey], "ru") * dir;
    });
    return list;
  }, [rows, query, statusFilter, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      xp: filtered.reduce((s, r) => s + r.xp, 0),
      approved: filtered.filter((r) => r.xp > 0).length,
      pending: filtered.filter((r) => r.status === "pending" || r.status === "На проверке").length,
    }),
    [filtered]
  );

  // ===== Данные матрицы: последние 7 дней (с навигацией по неделям) =====
  const nowMskDay = useMemo(() => {
    const now = Date.now();
    return now - ((now + 3 * 3600000) % DAY_MS);
  }, []);

  const matrixDays = useMemo(() => {
    const end = nowMskDay - weekOffset * 7 * DAY_MS;
    const days: { key: string; ms: number; label: string; weekday: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const ms = end - i * DAY_MS;
      const d = new Date(ms + 3 * 3600000);
      days.push({
        key: mskDayKey(ms),
        ms,
        label: d.toISOString().slice(8, 10) + "." + d.toISOString().slice(5, 7),
        weekday: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getUTCDay()],
        isToday: weekOffset === 0 && i === 0,
      });
    }
    return days;
  }, [nowMskDay, weekOffset]);

  const matrix = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Группируем отчёты по модератору
    const byUser = new Map<
      string,
      { nick: string; email: string; weekXp: number; totalXp: number; cells: Map<string, Row> }
    >();
    for (const r of rows) {
      if (!r.email) continue;
      let u = byUser.get(r.email);
      if (!u) {
        u = { nick: r.nick, email: r.email, weekXp: 0, totalXp: 0, cells: new Map() };
        byUser.set(r.email, u);
      }
      // Ник берём из самого свежего отчёта
      if (r.dayMs > 0 && r.nick && r.nick !== "Модератор") u.nick = r.nick;
      u.totalXp += r.xp;
      const dayKey = mskDayKey(r.dayMs);
      const existing = u.cells.get(dayKey);
      // Из нескольких отчётов за день показываем лучший
      if (!existing || (CELL_RANK[cellKindOf(r)] || 0) > (CELL_RANK[cellKindOf(existing)] || 0)) {
        u.cells.set(dayKey, r);
      }
    }
    const inWindow = new Set(matrixDays.map((d) => d.key));
    const users = [...byUser.values()]
      .map((u) => ({
        ...u,
        weekXp: [...u.cells.entries()]
          .filter(([k]) => inWindow.has(k))
          .reduce((s, [, r]) => s + r.xp, 0),
      }))
      .filter(
        (u) =>
          !q || u.nick.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    // Сортировка: активные за неделю сверху, дальше по общему XP
    users.sort((a, b) => b.weekXp - a.weekXp || b.totalXp - a.totalXp || a.nick.localeCompare(b.nick, "ru"));
    return users;
  }, [rows, matrixDays, query]);

  const weekLabel = `${matrixDays[0]?.label} — ${matrixDays[6]?.label}`;

  // Данные для графика «Активность»: только одобренные и ожидающие отчёты недели
  const activityReports = useMemo(
    () => rows.map((r) => ({ dayKey: mskDayKey(r.dayMs), xp: r.xp })),
    [rows]
  );

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Table2 className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">
                Таблица отчётов
              </h1>
              <p className="text-muted-foreground text-sm">
                {loading
                  ? "Загрузка..."
                  : view === "matrix"
                    ? `Модераторов: ${matrix.length}`
                    : `Всего записей: ${filtered.length}`}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {/* Переключатель вида */}
            <div className="border-border bg-secondary/60 flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setView("matrix")}
                aria-pressed={view === "matrix"}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === "matrix"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-3.5" />
                Матрица
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Rows3 className="size-3.5" />
                Список
              </button>
            </div>

            <div className="relative flex-1 sm:flex-none">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по нику или email"
                className="w-full pl-8 sm:w-56"
              />
            </div>
            {view === "list" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="approved">Одобрено</SelectItem>
                  <SelectItem value="pending">На проверке</SelectItem>
                  <SelectItem value="rejected">Отклонено</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </Reveal>

      {/* ===== МАТРИЦА: модератор x дни ===== */}
      {view === "matrix" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          {/* График активности за выбранную неделю */}
          {!loading && <ActivityChart days={matrixDays} reports={activityReports} />}
          {/* Панель недели + легенда */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Предыдущая неделя"
                className="border-border bg-card hover:bg-secondary flex size-8 items-center justify-center rounded-lg border transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="border-border bg-card rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums">
                {weekLabel}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                disabled={weekOffset === 0}
                aria-label="Следующая неделя"
                className="border-border bg-card hover:bg-secondary flex size-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
              {weekOffset > 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="text-primary ml-1 text-xs font-semibold hover:underline"
                >
                  К текущей
                </button>
              )}
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {(["hero", "over", "ok", "pending", "rejected", "none"] as CellKind[]).map((k) => {
                const s = CELL_STYLE[k];
                const Icon = s.icon;
                return (
                  <span key={k} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded border",
                        s.chip
                      )}
                    >
                      <Icon className="size-2.5" />
                    </span>
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="bg-card border-border/60 overflow-hidden rounded-2xl border shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-secondary/95 backdrop-blur-sm">
                    <th className="border-border/60 bg-secondary/95 sticky left-0 z-10 min-w-44 border-r border-b px-3.5 py-2.5 text-left text-xs font-bold tracking-wide uppercase backdrop-blur-sm">
                      Модератор
                    </th>
                    {matrixDays.map((d) => (
                      <th
                        key={d.key}
                        className={cn(
                          "border-border/60 min-w-[92px] border-r border-b px-2 py-2 text-center",
                          d.isToday && "bg-primary/10"
                        )}
                      >
                        <span
                          className={cn(
                            "block text-xs font-bold tabular-nums",
                            d.isToday ? "text-primary" : "text-foreground"
                          )}
                        >
                          {d.label}
                        </span>
                        <span className="text-muted-foreground block text-[10px] font-medium uppercase">
                          {d.weekday}
                        </span>
                      </th>
                    ))}
                    <th className="border-border/60 text-muted-foreground w-24 border-b px-3 py-2.5 text-right text-xs font-bold tracking-wide uppercase">
                      XP/нед
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((u, rowIdx) => (
                    <tr
                      key={u.email}
                      className={cn(
                        "hover:bg-primary/5 transition-colors",
                        rowIdx % 2 === 1 && "bg-muted/30"
                      )}
                    >
                      <td className="border-border/40 bg-card sticky left-0 z-10 border-r border-b px-3.5 py-2">
                        <span className="block truncate font-semibold">{u.nick}</span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {u.email}
                        </span>
                      </td>
                      {matrixDays.map((d) => {
                        const report = u.cells.get(d.key);
                        const isFuture = d.ms > nowMskDay;
                        const kind: CellKind = isFuture ? "future" : report ? cellKindOf(report) : "none";
                        const s = CELL_STYLE[kind];
                        const Icon = s.icon;
                        const chip = (
                          <span
                            className={cn(
                              "mx-auto flex h-8 w-full max-w-20 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold",
                              s.chip
                            )}
                          >
                            {kind !== "future" && <Icon className="size-3" />}
                            {report && report.xp > 0 && (
                              <span className="tabular-nums">+{report.xp}</span>
                            )}
                          </span>
                        );
                        return (
                          <td
                            key={d.key}
                            className={cn(
                              "border-border/40 border-r border-b px-1.5 py-1.5",
                              d.isToday && "bg-primary/5"
                            )}
                          >
                            {report ? (
                              <Tooltip>
                                <TooltipTrigger asChild>{chip}</TooltipTrigger>
                                <TooltipContent side="top" className="max-w-64">
                                  <p className="font-semibold">{s.label}{report.xp > 0 ? ` · +${report.xp} XP` : ""}</p>
                                  <p className="mt-1 line-clamp-4 text-xs opacity-80">{report.work}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              chip
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={cn(
                          "border-border/40 border-b px-3 py-2 text-right font-bold tabular-nums",
                          u.weekXp > 0 ? "text-green-deep" : "text-muted-foreground/60"
                        )}
                      >
                        {u.weekXp > 0 ? `+${u.weekXp}` : "0"}
                      </td>
                    </tr>
                  ))}
                  {!loading && matrix.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-muted-foreground px-4 py-10 text-center">
                        Ничего не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== СПИСОК (мобайл): карточки ===== */}
      {view === "list" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="md:hidden">
          <div className="flex flex-col gap-2">
            {filtered.slice(0, 150).map((r) => {
              const pending = r.status === "pending" || r.status === "На проверке";
              return (
                <div key={r.id} className="bg-card border-border/60 rounded-2xl border p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.nick}</span>
                    <Badge variant={pending ? "secondary" : r.xp > 0 ? "success" : "destructive"}>
                      {pending ? "На проверке" : r.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{r.work}</p>
                  <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                    <span className="tabular-nums">{r.day}</span>
                    <span className="text-foreground font-semibold tabular-nums">
                      {r.xp > 0 ? `+${r.xp} XP` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="text-muted-foreground py-10 text-center text-sm">Ничего не найдено</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ===== СПИСОК (десктоп): Excel-стиль ===== */}
      {view === "list" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden md:block"
        >
          <div className="bg-card border-border/60 overflow-hidden rounded-2xl border shadow-sm">
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-secondary/95 text-secondary-foreground backdrop-blur-sm">
                    {/* Нумерация строк как в Excel */}
                    <th className="border-border/60 text-muted-foreground w-12 border-r border-b px-2 py-2.5 text-center text-xs font-semibold">
                      №
                    </th>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-border/60 border-r border-b px-3.5 py-2.5 text-left text-xs font-bold tracking-wide uppercase last:border-r-0",
                          col.className
                        )}
                      >
                        {col.sortable ? (
                          <button
                            onClick={() => toggleSort(col.key as SortKey)}
                            className={cn(
                              "hover:text-primary inline-flex items-center gap-1 transition-colors",
                              col.key === "xp" && "w-full justify-end"
                            )}
                          >
                            {col.label}
                            {sortKey === col.key ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((r, i) => {
                    const pending = r.status === "pending" || r.status === "На проверке";
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "hover:bg-primary/5 transition-colors",
                          i % 2 === 1 && "bg-muted/30"
                        )}
                      >
                        <td className="border-border/40 text-muted-foreground border-r border-b px-2 py-2 text-center text-xs tabular-nums">
                          {i + 1}
                        </td>
                        <td className="border-border/40 border-r border-b px-3.5 py-2 whitespace-nowrap tabular-nums">
                          {r.day}
                        </td>
                        <td className="border-border/40 border-r border-b px-3.5 py-2 font-medium">
                          {r.nick}
                        </td>
                        <td
                          className="border-border/40 text-muted-foreground max-w-md truncate border-r border-b px-3.5 py-2"
                          title={r.work}
                        >
                          {r.work}
                        </td>
                        <td className="border-border/40 border-r border-b px-3.5 py-2">
                          <Badge variant={pending ? "secondary" : r.xp > 0 ? "success" : "destructive"}>
                            {pending ? "На проверке" : r.status}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "border-border/40 border-b px-3.5 py-2 text-right font-semibold tabular-nums",
                            r.xp > 0 ? "text-green-deep" : "text-muted-foreground"
                          )}
                        >
                          {r.xp > 0 ? `+${r.xp}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground px-4 py-10 text-center">
                        Ничего не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Итоговая строка как в Excel */}
                {filtered.length > 0 && (
                  <tfoot className="sticky bottom-0">
                    <tr className="bg-secondary/95 font-semibold backdrop-blur-sm">
                      <td className="border-border/60 border-t px-2 py-2.5" />
                      <td colSpan={2} className="border-border/60 border-t px-3.5 py-2.5 text-xs">
                        Итого: {filtered.length} записей
                      </td>
                      <td className="border-border/60 text-muted-foreground border-t px-3.5 py-2.5 text-xs">
                        Одобрено: {totals.approved} · На проверке: {totals.pending}
                      </td>
                      <td className="border-border/60 border-t px-3.5 py-2.5 text-right text-xs" />
                      <td className="border-border/60 text-green-deep border-t px-3.5 py-2.5 text-right text-xs tabular-nums">
                        Σ +{totals.xp}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
