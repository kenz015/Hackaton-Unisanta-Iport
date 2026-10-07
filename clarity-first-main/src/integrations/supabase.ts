/**
 * Cliente do Supabase (login). Roda só no navegador.
 *
 * Variáveis no .env da pasta clarity-first-main:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=chave-publica (pode ficar no front, é pública)
 *
 * Sem essas variáveis o login entra em "modo demonstração".
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.trim();
const key = (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined)?.trim();

export const supabaseConfigured = !!url && !!key;

/** Chaves novas do Supabase (sb_publishable_...) não são JWT: vão só no header apikey. */
function supabaseFetch(apiKey: string): typeof fetch {
  const isNewKey = apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewKey && headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || typeof window === "undefined") return null;
  client ??= createClient(url!, key!, {
    global: { fetch: supabaseFetch(key!) },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage },
  });
  return client;
}
