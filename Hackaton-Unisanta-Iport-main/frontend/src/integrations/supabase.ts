/**
 * Cliente do Supabase (login). Roda só no navegador.
 *
 * Em desenvolvimento, permite um modo de demonstração local quando não há
 * configuração real do Supabase no ambiente. Em produção, o projeto deve usar
 * apenas os valores do ambiente correto.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const appEnvironment = ((import.meta.env['VITE_APP_ENV'] as string | undefined)?.trim() || import.meta.env.MODE || "development").toLowerCase();
const allowDemoMode = appEnvironment !== "production";

const envSupabaseUrl = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.trim();
const envSupabaseKey = (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined)?.trim();

const explicitSupabaseConfig = !!envSupabaseUrl && !!envSupabaseKey;
export const supabaseConfigured = explicitSupabaseConfig;
export const demoAuthAllowed = allowDemoMode && !supabaseConfigured;

const url = envSupabaseUrl?.trim() || "";
const key = envSupabaseKey?.trim() || "";

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
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Mantém a sessão só dentro da aba do navegador, reduzindo o tempo em que
      // o estado do usuário fica persistido em LocalStorage.
      storage: window.sessionStorage,
    },
  });
  return client;
}
