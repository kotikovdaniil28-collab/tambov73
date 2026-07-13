import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://icfihnroblyjjflsfepq.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_xOJInTnyFoMJKzfx6-ylmQ_HGA5kyd-";

export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Клиент для файлового хранилища: URL проекта выводится из самого service-ключа (поле ref в JWT),
// поэтому загрузка работает даже если ключ от другого Supabase-проекта, чем основная база сайта
export function getStorageClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  try {
    const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64url").toString()) as {
      ref?: string;
    };
    if (payload.ref) url = `https://${payload.ref}.supabase.co`;
  } catch {
    // Ключ нового формата (sb_secret_...) — ref не извлечь, используем URL из окружения
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function getAnonServerClient(accessToken?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}
