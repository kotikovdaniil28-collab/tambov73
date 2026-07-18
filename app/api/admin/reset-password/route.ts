import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getAnonServerClient } from "@/lib/supabase/admin";
import { LEADERSHIP_EMAILS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Сброс пароля пользователю руководством.
// Требует SUPABASE_SERVICE_ROLE_KEY: смена чужого пароля возможна только через admin API.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const anon = getAnonServerClient(token);
    const { data: userData, error: userErr } = await anon.auth.getUser();
    const caller = userData?.user;
    if (userErr || !caller?.id) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    let service;
    try {
      service = getServiceClient();
    } catch {
      return NextResponse.json(
        { error: "Сброс пароля не настроен (нет SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 },
      );
    }

    // Проверка прав: вызывающий должен быть руководством (по email-списку или роли leadership в БД).
    // Роль читается на сервере через service role — клиент не может её подделать.
    const lowerEmail = String(caller.email || "").toLowerCase();
    let isLeadership = LEADERSHIP_EMAILS.has(lowerEmail);
    if (!isLeadership) {
      const { data: roleRows } = await service
        .from("reports")
        .select("id")
        .eq("email", "ADMIN_ROLE")
        .eq("link", caller.id)
        .eq("status", "leadership")
        .limit(1);
      isLeadership = Boolean(roleRows?.length);
    }
    if (!isLeadership) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { userId?: string; password?: string };
    const userId = String(body.userId || "").trim();
    const password = String(body.password || "");
    if (!userId) return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
    }

    const { error: updErr } = await service.auth.admin.updateUserById(userId, { password });
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
