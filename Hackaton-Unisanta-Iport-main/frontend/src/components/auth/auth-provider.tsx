import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoAuthAllowed, getSupabase, supabaseConfigured } from "@/integrations/supabase";

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
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  sendReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  enterDemo: () => void;
  signOut: () => Promise<void>;
}

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

/** Traduz os erros do Supabase para mensagens curtas em português. */
function message(err: { code?: string | undefined; name?: string; status?: number | undefined }, fallback: string) {
  if (err.name === "AuthRetryableFetchError" || err.status === 0) return "Sem conexão com o servidor de login. Verifique a internet e tente de novo.";
  switch (err.code) {
    case "invalid_credentials": return "E-mail ou senha incorretos.";
    case "email_not_confirmed": return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
    case "user_already_exists": return "Já existe uma conta com esse e-mail.";
    case "weak_password": return "Senha fraca. Use pelo menos 8 caracteres.";
    case "over_email_send_rate_limit": return "Muitas tentativas. Espere um pouco e tente de novo.";
    default: return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const demoMode = demoAuthAllowed && !supabaseConfigured;

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      if (!demoMode) {
        setUser(null);
        setReady(true);
        return;
      }
      const storage = getSessionStorage();
      try {
        const saved = storage?.getItem(DEMO_KEY);
        if (saved) {
          setUser(JSON.parse(saved) as AuthUser);
        } else {
          const demoUser = fromEmail("demo", "gestor.demo@icrew.com.br", true);
          storage?.setItem(DEMO_KEY, JSON.stringify(demoUser));
          setUser(demoUser);
        }
      } catch { /* sessionStorage indisponível */ }
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
    try {
      const { error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
      return error ? message(error, "Não foi possível criar a conta. Confira os dados.") : null;
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
    const { error } = await sb.auth.updateUser({ password });
    if (error) return message(error, "Não foi possível salvar a nova senha. Abra o link do e-mail de novo.");
    setRecovering(false);
    return null;
  }, []);

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
    () => ({ user, ready, configured: supabaseConfigured, demoMode, recovering, signIn, signUp, sendReset, updatePassword, enterDemo, signOut }),
    [user, ready, demoMode, recovering, signIn, signUp, sendReset, updatePassword, enterDemo, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
