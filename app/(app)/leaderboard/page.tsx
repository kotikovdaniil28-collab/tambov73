import type { Metadata } from "next";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";

export const metadata: Metadata = {
  title: "Лидерборд — TAMBOV Moderation",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
