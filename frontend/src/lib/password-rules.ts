/**
 * Regras de senha do iCrew.
 *
 * Conferidas no navegador ANTES de enviar ao Supabase, para mostrar na hora
 * exatamente o que falta. Devem ser iguais (ou mais rígidas) que a política
 * configurada no Supabase: Authentication → Policies/Providers → Password.
 */

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordRule {
  id: "length" | "lower" | "upper" | "number" | "special";
  /** Texto da lista de requisitos (tela de criar conta). */
  label: string;
  /** Como aparece na frase "Faltam ..." (plural) e "Falta ..." (singular). */
  plural: string;
  singular: string;
  ok: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`, plural: "", singular: "", ok: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { id: "lower", label: "Uma letra minúscula (a-z)", plural: "letras minúsculas", singular: "uma letra minúscula", ok: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "Uma letra maiúscula (A-Z)", plural: "letras maiúsculas", singular: "uma letra maiúscula", ok: (p) => /[A-Z]/.test(p) },
  { id: "number", label: "Um número (0-9)", plural: "números", singular: "um número", ok: (p) => /[0-9]/.test(p) },
  { id: "special", label: "Um caractere especial (!@#$)", plural: "caracteres especiais (! @ # $ % …)", singular: "um caractere especial (! @ # $ % …)", ok: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const joinPt = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Confere a senha e devolve uma mensagem clara com TUDO o que está errado,
 * ou null se a senha passou. Ex.: "Faltam números e caracteres especiais."
 */
export function checkPassword(password: string, email = ""): string | null {
  const problems: string[] = [];

  if (!password) return "Digite uma senha.";
  if (password.trim() !== password) problems.push("A senha não pode começar nem terminar com espaço.");

  if (password.length < MIN_PASSWORD_LENGTH) {
    const faltam = MIN_PASSWORD_LENGTH - password.length;
    problems.push(`A senha está curta: tem ${password.length} caractere${password.length === 1 ? "" : "s"}, ${faltam === 1 ? "falta 1" : `faltam ${faltam}`} para chegar a ${MIN_PASSWORD_LENGTH}.`);
  }

  const missing = PASSWORD_RULES.filter((r) => r.id !== "length" && !r.ok(password));
  if (missing.length === 1) problems.push(`Falta ${missing[0]!.singular}.`);
  else if (missing.length > 1) problems.push(`Faltam ${joinPt(missing.map((r) => r.plural))}.`);

  if (/(.)\1{3,}/.test(password)) problems.push("Evite repetir o mesmo caractere várias vezes seguidas (ex.: aaaa, 1111).");

  const name = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (name.length >= 4 && password.toLowerCase().includes(name)) problems.push(`A senha não pode conter o seu e-mail (\"${email.split("@")[0]}\").`);

  return problems.length ? problems.map(cap).join(" ") : null;
}

/** Mensagem para senha que aparece em vazamentos conhecidos (aviso do Supabase). */
export const COMMON_PASSWORD_MESSAGE =
  "Essa senha é muito comum e fácil de adivinhar. Escolha outra senha, menos comum (ex.: misture palavras que só você conhece com números e símbolos).";
