import { NextRequest, NextResponse } from "next/server";
import { getStorageClient, getAnonServerClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "avatars";
const MAX_SIZE = 4 * 1024 * 1024; // 4 МБ на аватар
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

let bucketReady = false;

// Бакет публичный на чтение: аватарки должны открываться в профиле без токена
async function ensureBucket(admin: ReturnType<typeof getStorageClient>) {
  if (bucketReady) return;
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) {
    await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: [...ALLOWED],
    });
  }
  bucketReady = true;
}

export async function POST(req: NextRequest) {
  // Авторизация: принимаем только запросы от залогиненных пользователей сайта
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const anon = getAnonServerClient(token);
  const { data: userData, error: userErr } = await anon.auth.getUser();
  const user = userData?.user;
  if (userErr || !user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Файл больше 4 МБ" }, { status: 413 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Только изображения (PNG, JPEG, WebP, GIF)" }, { status: 415 });
  }

  let admin;
  try {
    admin = getStorageClient();
  } catch {
    return NextResponse.json(
      { error: "Загрузка файлов не настроена (нет SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 },
    );
  }

  try {
    await ensureBucket(admin);
    const ext = (file.name.split(".").pop() || "png").replace(/[^\w]+/g, "").slice(0, 8) || "png";
    // Каждая загрузка — свой путь: старый файл не мешает, а свежий URL обходит кеш браузера
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "image/png",
      upsert: true,
    });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
