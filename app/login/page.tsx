import type { Metadata } from "next";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Вход — TAMBOV Moderation",
};

export default function LoginPage() {
  return <LoginClient />;
}
