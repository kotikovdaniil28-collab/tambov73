"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { RANKS } from "@/lib/constants";
import { Reveal, SecHead } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type CareerRow = {
  site_user_id: string;
  nickname: string | null;
  rank: string | null;
  active: boolean | null;
  appointed_at: string | null;
  rank_started_at: string | null;
};

type TimelineEvent = {
  key: string;
  kind: "appointed" | "promoted";
  nickname: string;
  rankTitle: string;
  rankShort: string;
  at: number;
};

const RANK_ORDER = ["junior_moderator", "moderator", "senior_moderator", "km", "zgm", "gm", "kgm"];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function TeamHistoryClient() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CareerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await getSupabase()
        .from("moderator_careers")
        .select("site_user_id, nickname, rank, active, appointed_at, rank_started_at")
        .order("appointed_at", { ascending: false });
      if (!mounted) return;
      setRows((data || []) as CareerRow[]);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];
    for (const r of rows) {
      if (!r.active) continue;
      const nickname = r.nickname || "Модератор";
      const rank = RANKS[String(r.rank)] || { short: "?", title: String(r.rank || "Модератор") };
      const appointed = r.appointed_at ? new Date(r.appointed_at).getTime() : NaN;
      const started = r.rank_started_at ? new Date(r.rank_started_at).getTime() : NaN;

      if (Number.isFinite(appointed)) {
        list.push({
          key: `${r.site_user_id}-app`,
          kind: "appointed",
          nickname,
          rankTitle: "Назначение в команду",
          rankShort: "ММ",
          at: appointed,
        });
      }
      // Повышение: дата начала текущего ранга отличается от даты назначения
      if (Number.isFinite(started) && Number.isFinite(appointed) && started - appointed > 86_400_000) {
        list.push({
          key: `${r.site_user_id}-promo`,
          kind: "promoted",
          nickname,
          rankTitle: `Повышение до «${rank.title}»`,
          rankShort: rank.short,
          at: started,
        });
      }
    }
    return list.sort((a, b) => b.at - a.at);
  }, [rows]);

  const team = useMemo(() => {
    return [...rows]
      .filter((r) => r.active)
      .sort(
        (a, b) => RANK_ORDER.indexOf(String(b.rank)) - RANK_ORDER.indexOf(String(a.rank)),
      );
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <Reveal i={0}>
        <div className="bg-card rounded-2xl border p-6">
          <div className="flex items-center gap-3">
            <span className="bg-green/15 text-green-deep flex size-10 items-center justify-center rounded-xl">
              <Users className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold">Команда</h1>
              <p className="text-muted-foreground text-sm">
                История назначений и повышений — данные синхронизируются ботом из Google Таблицы
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Таймлайн */}
        <Reveal i={1}>
          <SecHead title="Хроника" hint="повышения и назначения" />
          {loading ? (
            <div className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
              Загружаем историю…
            </div>
          ) : events.length === 0 ? (
            <div className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
              Пока нет событий — бот заполнит хронику после синхронизации состава.
            </div>
          ) : (
            <ol className="relative flex flex-col gap-0">
              {events.map((e, idx) => (
                <li key={e.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Линия таймлайна */}
                  {idx < events.length - 1 && (
                    <span aria-hidden className="bg-border absolute top-10 left-[19px] h-full w-px" />
                  )}
                  <span
                    className={cn(
                      "relative z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border",
                      e.kind === "promoted"
                        ? "bg-amber/15 text-amber-deep border-amber/40"
                        : "bg-green/15 text-green-deep border-green/40",
                    )}
                  >
                    {e.kind === "promoted" ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                  </span>
                  <div className="bg-card min-w-0 flex-1 rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">{e.nickname}</p>
                      <time className="text-muted-foreground text-xs font-semibold">
                        {fmtDate(e.at)}
                      </time>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-sm">{e.rankTitle}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Reveal>

        {/* Текущий состав */}
        <Reveal i={2}>
          <SecHead title="Состав" hint={`${team.length} активных`} />
          <div className="bg-card rounded-2xl border p-4">
            <ul className="flex flex-col gap-1">
              {team.map((m) => {
                const rank = RANKS[String(m.rank)] || { short: "?", title: String(m.rank || "—") };
                return (
                  <li
                    key={m.site_user_id}
                    className="hover:bg-secondary flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
                  >
                    <span className="bg-linear-to-br from-green-bright to-green-deep text-primary-foreground font-display flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold">
                      {rank.short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.nickname || "Модератор"}</p>
                      <p className="text-muted-foreground truncate text-xs">{rank.title}</p>
                    </div>
                    <ShieldCheck className="text-green-deep size-4 shrink-0" />
                  </li>
                );
              })}
              {!loading && team.length === 0 && (
                <li className="text-muted-foreground p-2 text-sm">Состав ещё не синхронизирован.</li>
              )}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
