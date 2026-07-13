import type { Metadata } from "next";
import { HelpClient } from "@/components/help/help-client";

export const metadata: Metadata = {
  title: "Инструкция — TAMBOV Moderation",
};

export default function HelpPage() {
  return <HelpClient />;
}
