import { NextRequest, NextResponse } from "next/server";
import { getStorageClient, getAnonServerClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "report-proofs";
const MAX_SIZE = 8 * 1024 * 1024; // 8 МБ на файл
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/plain",
]);

let bucketReady = false;

// Бакет публичный на чтение: пруфы должны открываться у руководства и в VK-боте без токена
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
  if (userErr || !user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Файл больше 8 МБ" }, { status: 413 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Неподдерживаемый тип файла" }, { status: 415 });
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
    const safeName = (file.name || "file")
      .replace(/[^\w.\-]+/g, "_")
      .slice(-80);
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
