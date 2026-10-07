import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import portImage from "@/assets/port-terminal.jpg";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string | undefined } => {
    const r = search["redirect"];
    return { redirect: typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : undefined };
  },
  head: () => ({
    meta: [
      { title: "Entrar · iCrew" },
      { name: "description", content: "Acesse o iCrew, painel de capacidade da equipe da iPORT Solutions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, ready, configured, signIn, signUp, sendReset, enterDemo } = useAuth();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Já logado? Vai direto para o sistema.
  useEffect(() => {
    if (ready && user) void navigate({ to: redirect ?? "/dashboard", replace: true });
  }, [ready, user, redirect, navigate]);

  const change = (m: Mode) => { setMode(m); setError(""); setInfo(""); setPassword(""); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "login") {
        const err = await signIn(email, password);
        if (err) setError(err); // se deu certo, o useEffect acima redireciona
      } else if (mode === "signup") {
        const err = await signUp(email, password);
        if (err) setError(err);
        else { setInfo("Conta criada! Se pedirmos confirmação, abra o link que enviamos para o seu e-mail e depois entre aqui."); setPassword(""); }
      } else {
        const err = await sendReset(email);
        if (err) setError(err);
        else setInfo("Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.");
      }
    } finally {
      setBusy(false);
    }
  }

  const title = { login: "Entre na sua conta.", signup: "Crie sua conta.", forgot: "Recupere seu acesso." }[mode];
  const subtitle = {
    login: "Um horizonte mais claro para as entregas da sua equipe.",
    signup: "Use seu e-mail de trabalho. A senha precisa ter pelo menos 8 caracteres.",
    forgot: "Enviaremos um link para você criar uma nova senha.",
  }[mode];

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Lado da foto (some no celular) */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={portImage} alt="Terminal portuário com navio atracado" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.2_0.04_240/0.85)] via-[oklch(0.2_0.04_240/0.35)] to-transparent" />
        <div className="absolute inset-x-[10%] bottom-[14%] text-white">
          <p className="text-xs font-bold tracking-widest text-white/80">SUA OPERAÇÃO, NOSSOS SISTEMAS.</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight">Uma equipe conectada.<br />Tarefas em equilíbrio.</h2>
          <p className="mt-3 max-w-md text-sm text-white/80">Veja quem está livre, quem está no limite e o que mudar antes que vire problema.</p>
        </div>
        <p className="absolute bottom-8 left-[10%] text-xs text-white/70">iCrew · Desafio iPORT Solutions</p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden /> Voltar ao início
          </Link>
          <div className="mb-8 flex items-center gap-3">
            <img src="/logo.jpeg" alt="Logo iPORT" className="size-11 rounded-xl object-contain" />
            <div className="leading-tight">
              <div className="text-2xl font-extrabold tracking-tight text-primary">iCrew</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">iPORT Solutions</div>
            </div>
          </div>

          <span className="mb-5 grid size-11 place-items-center rounded-xl border border-border bg-card text-brand-cyan"><LockKeyhole className="size-5" aria-hidden /></span>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

          {error && <div role="alert" className="mt-5 rounded-lg border border-critical/30 bg-critical-soft px-3 py-2.5 text-sm text-critical">{error}</div>}
          {info && <div role="status" className="mt-5 rounded-lg border border-border bg-accent px-3 py-2.5 text-sm text-accent-foreground">{info}</div>}

          {configured ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {mode === "login" && (
                      <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => change("forgot")}>Esqueci minha senha</button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "signup" ? 8 : 1}
                      placeholder={mode === "signup" ? "No mínimo 8 caracteres" : "Sua senha"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-11"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9 text-muted-foreground" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow(!show)}>
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <Button type="submit" className="h-11 w-full rounded-lg" disabled={busy || !ready}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "login" ? "Entrar no sistema" : mode === "signup" ? "Criar conta" : "Enviar link"}
                <ArrowRight className="ml-auto size-4" />
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>Ainda não tem conta? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => change("signup")}>Criar conta</button></>
                ) : (
                  <button type="button" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" onClick={() => change("login")}><ArrowLeft className="size-3.5" /> Voltar para o login</button>
                )}
              </p>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-border bg-accent px-3 py-2.5 text-sm text-accent-foreground">
                O login com e-mail ainda não foi configurado neste computador (faltam as variáveis <code className="font-mono text-xs">VITE_SUPABASE_*</code> no <code className="font-mono text-xs">.env</code>).
              </div>
              <Button className="h-11 w-full rounded-lg" onClick={enterDemo} disabled={!ready}>
                <PlayCircle className="size-4" /> Entrar no modo demonstração
              </Button>
            </div>
          )}

          <p className="mt-10 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="size-3" aria-hidden /> Acesso seguro · iCrew</p>
        </div>
      </div>
    </div>
  );
}
