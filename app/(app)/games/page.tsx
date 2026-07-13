import type { Metadata } from "next";
import { GamesClient } from "@/components/games/games-client";

export const metadata: Metadata = {
  title: "Игры — TAMBOV Moderation",
};

export default function GamesPage() {
  return <GamesClient />;
}
