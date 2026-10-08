import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha · iCrew" }] }),
  component: ResetPassword,
});

/** Aberta pelo link do e-mail "Esqueci minha senha". */
function ResetPassword() {
  const { user, ready, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("As senhas não são iguais."); return; }
    setBusy(true);
    const err = await updatePassword(password);
    setBusy(false);
    if (err) setError(err);
    else void navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="surface-card w-full max-w-sm p-6">
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-accent text-brand-cyan"><KeyRound className="size-5" /></span>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Crie uma nova senha</h1>
        {!ready ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Validando o link…</p>
        ) : !user ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Este link expirou ou já foi usado. Volte para o login e peça um novo em “Esqueci minha senha”.
            <Button variant="link" className="px-1" onClick={() => navigate({ to: "/auth" })}>Ir para o login</Button>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {error && <div role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">{error}</div>}
            <div className="space-y-1.5">
              <Label htmlFor="np">Nova senha</Label>
              <Input id="np" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp">Confirme a senha</Label>
              <Input id="cp" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
            </div>
            <Button type="submit" className="h-11 w-full rounded-lg" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Salvar e entrar <ArrowRight className="ml-auto size-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
