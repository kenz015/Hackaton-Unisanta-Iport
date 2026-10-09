import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password-rules";

/** Lista de requisitos da senha que vai marcando ✓ enquanto a pessoa digita. */
export function PasswordChecklist({ password, id = "password-rules" }: { password: string; id?: string }) {
  return (
    <ul id={id} className="grid gap-1 pt-1 text-xs sm:grid-cols-2" aria-label="Requisitos da senha">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.ok(password);
        return (
          <li key={rule.id} className={`flex items-center gap-1.5 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3 shrink-0" aria-hidden />}
            <span>{rule.label}</span>
            <span className="sr-only">{ok ? "(ok)" : "(falta)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
