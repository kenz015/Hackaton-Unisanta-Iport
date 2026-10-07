import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabase, supabaseConfigured } from "@/integrations/supabase";

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

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      // Sem Supabase: só existe o modo demonstração
      try {
        const saved = localStorage.getItem(DEMO_KEY);
        if (saved) setUser(JSON.parse(saved) as AuthUser);
      } catch { /* localStorage indisponível */ }
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
    if (!sb) return "Login não configurado. Use o modo demonstração.";
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      return error ? message(error, "Não foi possível entrar. Confira seu e-mail e senha.") : null;
    } catch {
      return "Sem conexão com o servidor de login. Verifique a internet.";
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return "Login não configurado.";
    try {
      const { error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
      return error ? message(error, "Não foi possível criar a conta. Confira os dados.") : null;
    } catch {
      return "Sem conexão com o servidor de login.";
    }
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) return "Login não configurado.";
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      return error ? message(error, "Não foi possível enviar o e-mail agora.") : null;
    } catch {
      return "Sem conexão com o servidor de login.";
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const sb = getSupabase();
    if (!sb) return "Login não configurado.";
    const { error } = await sb.auth.updateUser({ password });
    if (error) return message(error, "Não foi possível salvar a nova senha. Abra o link do e-mail de novo.");
    setRecovering(false);
    return null;
  }, []);

  const enterDemo = useCallback(() => {
    const demo = fromEmail("demo", "gestor.demo@iport.com.br", true);
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
    setUser(demo);
  }, []);

  const signOut = useCallback(async () => {
    try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    await getSupabase()?.auth.signOut().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, configured: supabaseConfigured, recovering, signIn, signUp, sendReset, updatePassword, enterDemo, signOut }),
    [user, ready, recovering, signIn, signUp, sendReset, updatePassword, enterDemo, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
