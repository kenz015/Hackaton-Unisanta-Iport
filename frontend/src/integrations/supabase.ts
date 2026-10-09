/**
 * Cliente do Supabase (login). Roda só no navegador.
 *
 * O login real (e-mail + senha) fica SEMPRE ligado: se o .env não tiver
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, usamos os valores
 * públicos do projeto iCrew abaixo. Assim ninguém entra sem senha só porque
 * esqueceu de criar o .env.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Valores PÚBLICOS do projeto Supabase (Lovable Cloud) do iCrew.
 * A "publishable key" é feita para ficar no navegador — não é segredo.
 * Para apontar para outro projeto, defina as variáveis no .env.
 */
const DEFAULT_SUPABASE_URL = "https://sapugrjzkiuglcyfhkwq.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jHnUinmhJH982AKRFRMYcA_GImiXvUg";

const envSupabaseUrl = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.trim();
const envSupabaseKey = (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined)?.trim();

const url = envSupabaseUrl || DEFAULT_SUPABASE_URL;
const key = envSupabaseKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = !!url && !!key;
/** Endereço e chave pública do Supabase (usados também no servidor para validar o login). */
export const SUPABASE_URL = url.replace(/\/$/, "");
export const SUPABASE_PUBLISHABLE_KEY = key;
/** Modo demonstração (entrar sem senha) desligado: o acesso é só com login real. */
export const demoAuthAllowed = false;

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

/**
 * Token de acesso da sessão atual (ou null se ninguém estiver logado).
 * Vai junto nas chamadas ao servidor, que confere no Supabase se o login é válido.
 */
export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
