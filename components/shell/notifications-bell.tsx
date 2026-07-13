"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BadgeCheck, XCircle, Flame, Star } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { APPROVED_STATUSES, KV_EMAILS } from "@/lib/constants";
import { parseReportPayload, type ReportRow } from "@/lib/reports";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Отметка «прочитано» хранится в reports как KV-строка (та же схема, что и остальные сервисные записи)
const SEEN_SENTINEL = "NOTIF_SEEN_V1";

type Notif = {
  id: string;
  title: string;
  sub: string;
  ts: number;
  kind: "approved" | "rejected" | "strong";
};

function rowTs(r: ReportRow): number {
  // id формата "<prefix><Date.now()><rand>" — вытаскиваем таймстамп
  const m = String(r.id).match(/(1[6-9]\d{11})/);
  return m ? Number(m[1]) : 0;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [seenTs, setSeenTs] = useState<number | null>(null);

  const { data: rows } = useSWR(
    user ? ["notif-reports", user.email] : null,
    async () => {
      const { data } = await getSupabase()
        .from("reports")
        .select("*")
        .eq("email", user!.email!)
        .order("id", { ascending: false })
        .limit(40);
      return ((data || []) as ReportRow[]).filter((r) => !KV_EMAILS.has(String(r.email)));
    },
    { refreshInterval: 60_000 },
  );

  // Загрузка отметки «прочитано»
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await getSupabase()
        .from("reports")
        .select("*")
        .eq("email", SEEN_SENTINEL)
        .eq("link", user.id)
        .limit(1);
      if (!mounted) return;
      const raw = data?.[0]?.date;
      const ts = raw ? Number(raw) : 0;
      setSeenTs(Number.isFinite(ts) ? ts : 0);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const notifs = useMemo<Notif[]>(() => {
    const list: Notif[] = [];
    for (const r of rows || []) {
      const status = String(r.status || "");
      if (!status || status === "pending" || status === "На проверке") continue;
      const p = parseReportPayload(r);
      const ts = rowTs(r);
      const approved = APPROVED_STATUSES.has(status) || (Number(r.xp) || 0) > 0;
      const strong = status === "Перенорма" || status === "Герой дня";
      list.push({
        id: r.id,
        title: strong
          ? `Отчёт отмечен: ${status}`
          : approved
            ? "Отчёт одобрен"
            : `Отчёт не засчитан`,
        sub: `${p.day} · ${status}${Number(r.xp) > 0 ? ` · +${r.xp} XP` : ""}`,
        ts,
        kind: strong ? "strong" : approved ? "approved" : "rejected",
      });
    }
    return list.slice(0, 15);
  }, [rows]);

  const unread = seenTs == null ? 0 : notifs.filter((n) => n.ts > seenTs).length;

  const markSeen = async () => {
    if (!user) return;
    const now = Date.now();
    setSeenTs(now);
    const supa = getSupabase();
    const { data } = await supa
      .from("reports")
      .select("id")
      .eq("email", SEEN_SENTINEL)
      .eq("link", user.id)
      .limit(1);
    if (data && data.length > 0) {
      await supa.from("reports").update({ date: String(now) }).eq("id", data[0].id);
    } else {
      await supa.from("reports").insert([
        { id: `notif_${now}${Math.random().toString(36).slice(2, 6)}`, email: SEEN_SENTINEL, link: user.id, date: String(now), xp: 0 },
      ]);
    }
  };

  const ICONS: Record<Notif["kind"], typeof BadgeCheck> = {
    approved: BadgeCheck,
    rejected: XCircle,
    strong: Flame,
  };
  const COLORS: Record<Notif["kind"], string> = {
    approved: "bg-green/15 text-green-deep",
    rejected: "bg-destructive/10 text-destructive",
    strong: "bg-amber/20 text-amber-deep",
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unread > 0) void markSeen();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Уведомления${unread > 0 ? `, непрочитанных: ${unread}` : ""}`}
          className="border-input bg-secondary hover:bg-card relative flex size-8 items-center justify-center rounded-full border transition-colors"
        >
          <Bell className="size-3.5" />
          {unread > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Star className="text-amber-deep size-3.5" />
          Уведомления
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifs.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            Пока пусто — здесь появятся решения по вашим отчётам.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifs.map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <li key={n.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                      COLORS[n.kind],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-muted-foreground truncate text-xs">{n.sub}</p>
                  </div>
                  {seenTs != null && n.ts > seenTs && (
                    <span aria-hidden className="bg-green mt-2 size-1.5 shrink-0 rounded-full" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
