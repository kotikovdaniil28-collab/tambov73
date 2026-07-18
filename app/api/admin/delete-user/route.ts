import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getAnonServerClient } from "@/lib/supabase/admin";
import { CREATOR_EMAIL, LEADERSHIP_EMAILS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Полное удаление аккаунта пользователя руководством.
// Требует SUPABASE_SERVICE_ROLE_KEY: удаление auth-пользователя возможно только через admin API.
// Сносит и связанные данные: отчёты, роли, XP-дельты, карьеру, VK-привязку, логи покупок.
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
        { error: "Удаление не настроено (нет SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 },
      );
    }

    // Проверка прав: вызывающий должен быть руководством (по email-списку или роли leadership в БД).
    // Роль читается на сервере через service role — клиент не может её подделать.
    const callerEmail = String(caller.email || "").toLowerCase();
    let isLeadership = LEADERSHIP_EMAILS.has(callerEmail);
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

    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    const userId = String(body.userId || "").trim();
    if (!userId) return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });

    // Нельзя удалить самого себя и нельзя удалить создателя проекта.
    if (userId === caller.id) {
      return NextResponse.json({ error: "Нельзя удалить свой аккаунт" }, { status: 400 });
    }

    // Определяем email цели (нужен для чистки строк, где ключ — email, а не user_id).
    const { data: targetUser } = await service.auth.admin.getUserById(userId);
    const targetEmail = String(targetUser?.user?.email || "").toLowerCase();
    if (targetEmail && targetEmail === CREATOR_EMAIL) {
      return NextResponse.json({ error: "Нельзя удалить аккаунт создателя" }, { status: 400 });
    }

    // 1) Чистим связанные данные. Ошибки отдельных таблиц не должны срывать всё удаление —
    //    собираем предупреждения, но продолжаем.
    const warnings: string[] = [];
    const cleanup = async (label: string, fn: () => PromiseLike<{ error: unknown }>) => {
      try {
        const { error } = await fn();
        if (error) warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      } catch (e) {
        warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    // Строки, где пользователь — по user_id в поле link (роли, XP-дельты, KV по пользователю)
    await cleanup("reports(link)", () => service.from("reports").delete().eq("link", userId));
    // Отчёты и любые строки, где ключ — email пользователя
    if (targetEmail) {
      await cleanup("reports(email)", () => service.from("reports").delete().eq("email", targetEmail));
      await cleanup("admin_logs", () => service.from("admin_logs").delete().eq("user_email", targetEmail));
    }
    await cleanup("user_stats", () => service.from("user_stats").delete().eq("user_id", userId));
    await cleanup("moderator_careers(site_user_id)", () =>
      service.from("moderator_careers").delete().eq("site_user_id", userId),
    );
    await cleanup("vk_links(site_user_id)", () =>
      service.from("vk_links").delete().eq("site_user_id", userId),
    );
    await cleanup("moderator_report_reviews", () =>
      service.from("moderator_report_reviews").delete().eq("site_user_id", userId),
    );

    // 2) Удаляем самого auth-пользователя — это делаем последним.
    const { error: delErr } = await service.auth.admin.deleteUser(userId);
    if (delErr) {
      return NextResponse.json(
        { error: `Данные очищены, но auth-аккаунт удалить не удалось: ${delErr.message}`, warnings },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
