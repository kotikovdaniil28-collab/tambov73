import type { Metadata } from "next";
import { ReportsClient } from "@/components/reports/reports-client";

export const metadata: Metadata = {
  title: "Отчёты — TAMBOV Moderation",
};

export default function ReportsPage() {
  return <ReportsClient />;
}
