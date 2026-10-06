import { Hammer } from "lucide-react";
import { PageHeader } from "./ui-bits";

export function ComingSoon({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Esta tela entra na próxima etapa." />
      <div className="surface-card max-w-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-highlight-soft text-highlight-foreground dark:text-highlight"><Hammer className="size-5" /></span>
          <p className="font-semibold text-foreground">O que vai ter aqui</p>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-cyan" />{i}</li>)}
        </ul>
      </div>
    </div>
  );
}
