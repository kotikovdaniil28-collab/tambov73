import type { Metadata } from "next";
import { ActionsClient } from "@/components/actions/actions-client";

export const metadata: Metadata = {
  title: "Действия — TAMBOV",
  description: "Аудит действий руководства и системы",
};

export default function ActionsPage() {
  return <ActionsClient />;
}
