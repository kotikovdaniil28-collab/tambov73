import type { Metadata } from "next";
import { ProfileClient } from "@/components/profile/profile-client";

export const metadata: Metadata = {
  title: "Профиль — TAMBOV Moderation",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
