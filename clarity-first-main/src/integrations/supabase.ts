/**
 * Cliente do Supabase (login). Roda só no navegador.
 *
 * Usa os valores públicos abaixo. Opcionalmente, o .env da pasta
 * clarity-first-main pode sobrescrever com VITE_SUPABASE_URL e
 * VITE_SUPABASE_PUBLISHABLE_KEY.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Valores PÚBLICOS do projeto Supabase (Lovable Cloud) do iCrew.
 * A "publishable key" é feita para ficar no navegador — não é segredo.
 * Assim o login funciona logo após o git pull, sem precisar de .env.
 * (Se quiser apontar para outro projeto, defina as variáveis no .env.)
 */
const DEFAULT_SUPABASE_URL = "https://sapugrjzkiuglcyfhkwq.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jHnUinmhJH982AKRFRMYcA_GImiXvUg";

const url = ((import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.trim() || DEFAULT_SUPABASE_URL).trim();
const key = ((import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined)?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY).trim();

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
