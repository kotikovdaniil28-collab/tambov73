"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, CheckCircle2, XCircle, ShoppingBag, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { isAnyAdmin } from "@/lib/roles";
import { parseReportPayload, type ReportRow } from "@/lib/reports";
import { Reveal } from "@/components/ui/reveal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type TimelineEntry = {
  id: string;
  kind: "verdict" | "purchase";
  title: string;
  detail: string;
  status: string;
  positive: boolean;
  vkSent?: boolean;
  proofs?: string[];
  ts: number;
};

function fmtTime(ts: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActionsClient() {
  const { user, roles } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "verdict" | "purchase">("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supa = getSupabase();
    const [reviewsRes, logsRes] = await Promise.all([
      supa
        .from("moderator_report_reviews")
        .select("report_id, email, final_status, xp, verdict, reason_text, notification_status, reviewed_at, source")
        .order("reviewed_at", { ascending: false })
        .limit(60),
      supa
        .from("admin_logs")
        .select("id, user_email, nickname, item_name, cost, type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const reviews = reviewsRes.data || [];

    // Подтягиваем сами отчёты, чтобы достать ссылки на доказательства (доква).
    const reportIds = reviews.map((r) => r.report_id).filter(Boolean) as string[];
    const proofsById = new Map<string, string[]>();
    if (reportIds.length) {
      const { data: reportRows } = await supa
        .from("reports")
        .select("id, email, link, date, status, xp")
        .in("id", reportIds);
      for (const row of reportRows || []) {
        const proofs = parseReportPayload(row as ReportRow).proofs;
        if (proofs.length) proofsById.set(String((row as ReportRow).id), proofs);
      }
    }

    const list: TimelineEntry[] = [];

    for (const r of reviews) {
      const positive = r.verdict !== "rejected";
      list.push({
        id: `rev_${r.report_id}`,
        kind: "verdict",
        title: String(r.email || "Модератор"),
        detail: `${r.final_status} · +${r.xp ?? 0} XP${r.reason_text ? ` · ${r.reason_text}` : ""}${
          r.source === "site" ? "" : " · через VK"
        }`,
        status: String(r.final_status || ""),
        positive,
        vkSent: r.notification_status === "sent",
        proofs: proofsById.get(String(r.report_id)) || [],
        ts: r.reviewed_at ? new Date(String(r.reviewed_at)).getTime() : 0,
      });
    }

    for (const l of logsRes.data || []) {
      list.push({
        id: `log_${l.id}`,
        kind: "purchase",
        title: String(l.nickname || l.user_email || "Модератор"),
        detail: `${l.item_name} · ${l.cost} XP · ${l.status}`,
        status: String(l.status || ""),
        positive: true,
        ts: l.created_at ? new Date(String(l.created_at)).getTime() : 0,
      });
    }

    list.sort((a, b) => b.ts - a.ts);
    setEntries(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAnyAdmin(roles)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <History className="text-muted-foreground size-8" />
        <p className="text-sm font-medium">Доступ только для руководства</p>
      </div>
    );
  }

  const shown = entries.filter((e) => filter === "all" || e.kind === filter);

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <History className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">Действия</h1>
              <p className="text-muted-foreground text-sm">Аудит руководства и системы</p>
            </div>
          </div>
          <div className="bg-muted flex rounded-xl p-1">
            {(
              [
                ["all", "Все"],
                ["verdict", "Вердикты"],
                ["purchase", "Покупки"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card border-border/60 h-20 animate-pulse rounded-2xl border" />
          ))}
        </div>
      )}

      {!loading && shown.length === 0 && (
        <p className="text-muted-foreground py-10 text-center text-sm">Пока нет записей.</p>
      )}

      {!loading && shown.length > 0 && (
        <Reveal delay={0.05}>
          <div className="bg-card border-border/60 rounded-2xl border p-4 md:p-6">
            <div className="border-border relative flex flex-col gap-0 border-l-2 pl-6">
              {shown.map((e, i) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.03, 0.4) } }}
                  className="relative pb-6 last:pb-0"
                >
                  <span
                    className={cn(
                      "border-card absolute top-1 -left-[31px] flex size-4 items-center justify-center rounded-full border-2",
                      e.kind === "purchase"
                        ? "bg-chart-4"
                        : e.positive
                          ? "bg-primary"
                          : "bg-destructive"
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {e.kind === "verdict" ? "вердикт по отчёту" : "покупка в магазине"}
                    </span>
                    <span className="text-muted-foreground/70 ml-auto text-xs tabular-nums">
                      {fmtTime(e.ts)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-sm">{e.detail}</span>
                    {e.kind === "verdict" &&
                      (e.positive ? (
                        <CheckCircle2 className="text-primary size-3.5 shrink-0" />
                      ) : (
                        <XCircle className="text-destructive size-3.5 shrink-0" />
                      ))}
                    {e.kind === "purchase" && <ShoppingBag className="text-chart-4 size-3.5 shrink-0" />}
                    {e.kind === "verdict" && e.vkSent && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <MessageCircle className="size-3" /> VK доставлено
                      </Badge>
                    )}
                  </div>
                  {e.kind === "verdict" && e.proofs && e.proofs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {e.proofs.map((url, j) => (
                        <a
                          key={j}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors"
                        >
                          <ExternalLink className="size-3" /> Доказательство {j + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}
