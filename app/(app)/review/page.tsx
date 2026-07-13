import type { Metadata } from "next";
import { ReviewClient } from "@/components/review/review-client";

export const metadata: Metadata = {
  title: "Проверка отчётов — TAMBOV Moderation",
};

export default function ReviewPage() {
  return <ReviewClient />;
}
