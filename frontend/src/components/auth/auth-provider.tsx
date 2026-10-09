import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoAuthAllowed, getSupabase, supabaseConfigured } from "@/integrations/supabase";
import { checkPassword, COMMON_PASSWORD_MESSAGE, MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  demo?: boolean;
}

interface AuthCtx {
  /** Usuário logado (null = deslogado). */
  user: AuthUser | null;
  /** false enquanto ainda estamos descobrindo se há sessão salva. */
  ready: boolean;
  /** true quando o Supabase está configurado no .env. */
  configured: boolean;
  /** true quando a aplicação está em modo demo local (apenas em desenvolvimento). */
  demoMode: boolean;
  /** true quando a pessoa abriu o link de "redefinir senha". */
  recovering: boolean;
  /** Para onde levar quem chegou por um link do e-mail (confirmação/nova senha); null = não veio de link. */
  callbackTarget: CallbackTarget | null;
  /** Mensagem de erro que veio no link do e-mail (ex.: link expirado). */
  callbackError: string | null;
  /** Marca o link do e-mail como já tratado. */
  consumeCallback: () => void;
  /** Apaga a mensagem de erro do link depois de mostrada. */
  clearCallbackError: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  sendReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  enterDemo: () => void;
  signOut: () => Promise<void>;
}

type CallbackTarget = "/dashboard" | "/reset-password" | "/auth";

/**
 * Lido assim que a página carrega, antes do Supabase limpar a URL.
 * Os links do e-mail chegam com #access_token=...&type=signup|recovery
 * (ou #error_code=... quando o link expirou). Às vezes o Supabase manda
 * para a página inicial em vez de /auth, então o iCrew mesmo encaminha.
 */
function readEmailCallback(): { target: CallbackTarget; errorCode: string | null } | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const get = (k: string) => hash.get(k) ?? query.get(k);
  const errorCode = get("error_code") ?? (get("error") ? "otp_expired" : null);
  if (errorCode) return { target: "/auth", errorCode };
  const type = get("type");
  if (type === "recovery") return { target: "/reset-password", errorCode: null };
  if (get("access_token") || get("code") || get("token_hash")) return { target: "/dashboard", errorCode: null };
  return null;
}
const EMAIL_CALLBACK = readEmailCallback();

const Ctx = createContext<AuthCtx | null>(null);
const DEMO_KEY = "icrew-demo-user";

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const fromEmail = (id: string, email: string, demo = false): AuthUser => ({
  id,
  email,
  demo,
  name: email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
});

type AuthErr = { code?: string | undefined; name?: string; status?: number | undefined; message?: string; reasons?: string[] };

/** Explica o que há de errado na senha recusada pelo Supabase. */
function weakPasswordMessage(err: AuthErr, password = "") {
  const reasons = err.reasons ?? [];
  if (reasons.length && reasons.every((r) => r === "pwned")) return COMMON_PASSWORD_MESSAGE;
  const parts: string[] = [];
  // O Supabase pode exigir um tamanho mínimo maior que o nosso
  const serverMin = Number((err.message ?? "").match(/at least (\d+) characters/i)?.[1] ?? 0);
  if (serverMin > password.length && password.length >= MIN_PASSWORD_LENGTH) parts.push(`A senha precisa de pelo menos ${serverMin} caracteres.`);
  const local = checkPassword(password);
  if (local) parts.push(local);
  if (reasons.includes("pwned")) parts.push(COMMON_PASSWORD_MESSAGE);
  return parts.join(" ") || "Senha fraca. Escolha outra senha, menos comum, com letras, números e símbolos.";
}

/** Traduz os erros do Supabase para mensagens curtas em português. */
function message(err: AuthErr, fallback: string, password?: string) {
  if (err.name === "AuthRetryableFetchError" || err.status === 0) return "Sem conexão com o servidor de login. Verifique a internet e tente de novo.";
  const raw = (err.message ?? "").toLowerCase();
  switch (err.code) {
    case "invalid_credentials": return "E-mail ou senha incorretos.";
    case "email_not_confirmed": return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada e o spam).";
    case "user_already_exists":
    case "email_exists": return "Já existe uma conta com esse e-mail. Tente entrar ou use \"Esqueci minha senha\".";
    case "weak_password": return weakPasswordMessage(err, password);
    case "same_password": return "A nova senha precisa ser diferente da senha atual.";
    case "email_address_invalid": return "Esse e-mail não é válido. Confira se digitou certo.";
    case "email_address_not_authorized": return "Esse e-mail não tem permissão para receber mensagens deste sistema.";
    case "signup_disabled":
    case "email_provider_disabled": return "O cadastro de novas contas está desativado no momento.";
    case "user_banned": return "Essa conta está bloqueada. Fale com o administrador.";
    case "user_not_found": return "Não encontramos uma conta com esse e-mail.";
    case "otp_expired":
    case "flow_state_expired": return "O link do e-mail expirou ou já foi usado. Peça um novo.";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found": return "Sua sessão expirou. Entre de novo.";
    case "over_email_send_rate_limit": return "Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.";
    case "over_request_rate_limit": return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
    case "validation_failed":
      if (raw.includes("email")) return "Esse e-mail não é válido. Confira se digitou certo.";
      if (raw.includes("password")) return weakPasswordMessage(err, password);
      return fallback;
  }
  // Erros sem código: deduz pelo status ou pelo texto
  if (err.status === 429) return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  if (raw.includes("password") && (raw.includes("characters") || raw.includes("weak"))) return weakPasswordMessage(err, password);
  if (raw.includes("invalid") && raw.includes("email")) return "Esse e-mail não é válido. Confira se digitou certo.";
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(EMAIL_CALLBACK?.target === "/reset-password");
  const [callback, setCallback] = useState(EMAIL_CALLBACK);
  const consumeCallback = useCallback(() => setCallback(null), []);
  const [callbackError, setCallbackError] = useState(() =>
    EMAIL_CALLBACK?.errorCode ? message({ code: EMAIL_CALLBACK.errorCode }, "Não foi possível validar o link do e-mail. Peça um novo.") : null,
  );
  const clearCallbackError = useCallback(() => setCallbackError(null), []);
  const demoMode = demoAuthAllowed && !supabaseConfigured;

  useEffect(() => {
    // Limpa qualquer "usuário demo" salvo por versões antigas (entrava sem senha).
    for (const store of [getSessionStorage(), typeof window !== "undefined" ? window.localStorage : null]) {
      try { store?.removeItem(DEMO_KEY); } catch { /* storage indisponível */ }
    }
    const sb = getSupabase();
    if (!sb) {
      // Sem Supabase não há como validar senha: ninguém entra.
      setUser(null);
      setReady(true);
      return;
    }
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user;
      setUser(u ? fromEmail(u.id, u.email ?? "") : null);
      setReady(true);
    }).catch(() => active && setReady(true));
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      const u = session?.user;
      setUser(u ? fromEmail(u.id, u.email ?? "") : null);
      setReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return demoMode ? "Login não configurado. Use o modo demonstração." : "Login real não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.";
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      return error ? message(error, "Não foi possível entrar. Confira seu e-mail e senha.") : null;
    } catch {
      return "Sem conexão com o servidor de login. Verifique a internet.";
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return demoMode ? "Login não configurado." : "Cadastro real não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return "Esse e-mail não é válido. Confira se digitou certo (ex.: nome@empresa.com.br).";
    const problem = checkPassword(password, email.trim());
    if (problem) return problem;
    try {
      const { error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
      return error ? message(error, "Não foi possível criar a conta. Confira os dados.", password) : null;
    } catch {
      return "Sem conexão com o servidor de login.";
    }
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) return demoMode ? "Login não configurado." : "Recuperação de senha não configurada. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.";
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      return error ? message(error, "Não foi possível enviar o e-mail agora.") : null;
    } catch {
      return "Sem conexão com o servidor de login.";
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const sb = getSupabase();
    if (!sb) return demoMode ? "Login não configurado." : "Senha não pode ser atualizada sem o Supabase configurado.";
    const problem = checkPassword(password, user?.email ?? "");
    if (problem) return problem;
    const { error } = await sb.auth.updateUser({ password });
    if (error) return message(error, "Não foi possível salvar a nova senha. Abra o link do e-mail de novo.", password);
    setRecovering(false);
    return null;
  }, [user]);

  const enterDemo = useCallback(() => {
    if (!demoMode) return;
    const demo = fromEmail("demo", "gestor.demo@icrew.com.br", true);
    const storage = getSessionStorage();
    try { storage?.setItem(DEMO_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
    setUser(demo);
  }, [demoMode]);

  const signOut = useCallback(async () => {
    const storage = getSessionStorage();
    try { storage?.removeItem(DEMO_KEY); } catch { /* ignore */ }
    await getSupabase()?.auth.signOut().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, configured: supabaseConfigured, demoMode, recovering, callbackTarget: callback?.target ?? null, callbackError, consumeCallback, clearCallbackError, signIn, signUp, sendReset, updatePassword, enterDemo, signOut }),
    [user, ready, demoMode, recovering, callback, callbackError, consumeCallback, clearCallbackError, signIn, signUp, sendReset, updatePassword, enterDemo, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
