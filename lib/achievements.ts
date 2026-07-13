// Достижения модератора — считаются на клиенте из отчётов и карьеры.
// Никаких новых таблиц: всё выводится из reports + moderator_careers.

import { APPROVED_STATUSES } from "@/lib/constants";
import { reportDayMs, type ReportRow } from "@/lib/reports";

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  /** 0..1 — прогресс до получения */
  progress: number;
  earned: boolean;
  /** Значение для подписи, например "7/10" */
  label: string;
  tier: "bronze" | "silver" | "gold";
};

const DAY = 86_400_000;

function isApproved(r: ReportRow): boolean {
  return APPROVED_STATUSES.has(String(r.status)) || (Number(r.xp) || 0) > 0;
}

/** Максимальная серия дней подряд с хотя бы одним отчётом */
function bestStreak(rows: ReportRow[]): number {
  const days = new Set<number>();
  for (const r of rows) {
    const t = reportDayMs(r);
    if (t > 0) days.add(Math.floor(t / DAY));
  }
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0;
  let cur = 0;
  let prev = Number.NEGATIVE_INFINITY;
  for (const d of sorted) {
    cur = d === prev + 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

function counter(
  id: string,
  title: string,
  desc: string,
  value: number,
  target: number,
  tier: Achievement["tier"],
): Achievement {
  return {
    id,
    title,
    desc,
    progress: Math.min(1, value / target),
    earned: value >= target,
    label: `${Math.min(value, target)}/${target}`,
    tier,
  };
}

export function buildAchievements(
  rows: ReportRow[],
  opts?: { daysOnRank?: number | null; modXp?: number },
): Achievement[] {
  const approved = rows.filter(isApproved).length;
  const heroes = rows.filter((r) => r.status === "Герой дня").length;
  const overnorm = rows.filter((r) => r.status === "Перенорма").length;
  const streak = bestStreak(rows);
  const decided = rows.filter(
    (r) => r.status && r.status !== "pending" && r.status !== "На проверке",
  );
  const qualityPct =
    decided.length >= 10 ? Math.round((decided.filter(isApproved).length / decided.length) * 100) : 0;
  const days = Math.max(0, opts?.daysOnRank ?? 0);
  const modXp = Math.max(0, opts?.modXp ?? 0);

  return [
    counter("first", "Первый шаг", "Сдать первый отчёт", rows.length, 1, "bronze"),
    counter("r10", "В строю", "10 одобренных отчётов", approved, 10, "bronze"),
    counter("r25", "Рабочая лошадка", "25 одобренных отчётов", approved, 25, "silver"),
    counter("r50", "Машина модерации", "50 одобренных отчётов", approved, 50, "gold"),
    counter("streak3", "Разгон", "Отчёты 3 дня подряд", streak, 3, "bronze"),
    counter("streak7", "Неделя без пропусков", "Отчёты 7 дней подряд", streak, 7, "silver"),
    counter("streak14", "Железная дисциплина", "Отчёты 14 дней подряд", streak, 14, "gold"),
    counter("hero1", "Герой дня", "Получить статус «Герой дня»", heroes, 1, "bronze"),
    counter("hero5", "Легенда смены", "5 статусов «Герой дня»", heroes, 5, "silver"),
    counter("over5", "Перевыполнение", "5 отчётов со статусом «Перенорма»", overnorm, 5, "silver"),
    {
      id: "quality",
      title: "Чистая работа",
      desc: "90%+ одобрений при 10+ проверенных отчётах",
      progress: decided.length >= 10 ? Math.min(1, qualityPct / 90) : Math.min(1, decided.length / 10),
      earned: decided.length >= 10 && qualityPct >= 90,
      label: decided.length >= 10 ? `${qualityPct}%` : `${decided.length}/10 проверено`,
      tier: "gold",
    },
    counter("days30", "Ветеран", "30 дней на текущей ступени", days, 30, "silver"),
    counter("days100", "Столетие", "100 дней на текущей ступени", days, 100, "gold"),
    counter("xp1000", "Копилка", "Накопить 1000 XP модерации", modXp, 1000, "silver"),
  ];
}
