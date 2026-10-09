import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv


def _load_env_files() -> None:
    root_dir = Path(__file__).resolve().parent
    project_root = root_dir.parent
    candidates = [
        root_dir / ".env",
        root_dir / ".." / ".env",
        project_root / ".env",
        project_root / "backend" / ".env",
        project_root / "frontend" / ".env",
    ]
    seen: set[str] = set()
    for candidate in candidates:
        path = candidate.resolve()
        if path.exists() and str(path) not in seen:
            load_dotenv(path, override=False)
            seen.add(str(path))


_load_env_files()

# Aceita a chave pelos dois nomes (o .env do Créu usa GEMINI_API_KEY); ignora valores de exemplo
api_key = next(
    (c for c in ((os.getenv(n) or "").strip() for n in ("AI_API_KEY", "GEMINI_API_KEY")) if c and not c.startswith("cole-")),
    "",
)
provider = (os.getenv("AI_PROVIDER") or "gemini").strip().lower()
model = (os.getenv("AI_MODEL") or "").strip()
if provider == "gemini" and not model.lower().startswith("gemini"):
    model = (os.getenv("GEMINI_MODEL") or "gemini-flash-lite-latest").strip()  # AI_MODEL era de outro provedor (ex.: gpt-4o-mini)
# Ordem de tentativa (404 = modelo indisponível para a conta → próximo). O "lite" é o mais rápido,
# e para uma explicação curta de alerta ele basta.
MODELOS_GEMINI = list(dict.fromkeys([model, "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-flash-latest"]))
# Tempo máximo para gerar a explicação (somando todas as tentativas). Depois disso, usa o texto padrão.
PRAZO_TOTAL_S = 25


def _normalizar_contexto_azure(contexto):
    """Transforma um item do Azure em um texto legível para a IA."""
    if not contexto:
        return ""

    if isinstance(contexto, dict):
        fields = contexto.get("fields", contexto)
        item_id = contexto.get("id") or ""
        titulo = fields.get("System.Title") if isinstance(fields, dict) else None
        tipo = fields.get("System.WorkItemType") if isinstance(fields, dict) else None
        estado = fields.get("System.State") if isinstance(fields, dict) else None
        responsavel = fields.get("System.AssignedTo") if isinstance(fields, dict) else None
        if isinstance(responsavel, dict):
            responsavel = responsavel.get("displayName") or responsavel.get("uniqueName")
        prioridade = fields.get("Microsoft.VSTS.Common.Priority") if isinstance(fields, dict) else None
        estimativa = fields.get("Microsoft.VSTS.Scheduling.OriginalEstimate") if isinstance(fields, dict) else None
        restante = fields.get("Microsoft.VSTS.Scheduling.RemainingWork") if isinstance(fields, dict) else None
        descricao = fields.get("System.Description") if isinstance(fields, dict) else None
        tags = fields.get("System.Tags") if isinstance(fields, dict) else None

        partes = [
            f"Item Azure DevOps #{item_id}" if item_id else "Item Azure DevOps",
            f"Título: {titulo}" if titulo else None,
            f"Tipo: {tipo}" if tipo else None,
            f"Estado: {estado}" if estado else None,
            f"Responsável: {responsavel}" if responsavel else None,
            f"Prioridade: {prioridade}" if prioridade else None,
            f"Estimativa original: {estimativa}" if estimativa else None,
            f"Trabalho restante: {restante}" if restante else None,
            f"Tags: {tags}" if tags else None,
            f"Descrição: {descricao}" if descricao else None,
        ]
        return "\n".join([p for p in partes if p])

    return str(contexto)


def _gerar_resposta_gemini(tipo_problema, descricao, contexto=None):
    """Consulta a API Gemini em formato livre com a chave configurada no ambiente."""
    if not api_key:
        raise RuntimeError("AI_API_KEY não configurada.")

    contexto_texto = _normalizar_contexto_azure(contexto)
    prompt = (
        "Você é um gestor de projetos e mentor ágil em português do Brasil. "
        "Explique o caso para um gestor, de forma clara e direta. "
        f"Tipo do alerta: {tipo_problema}. "
        f"Detalhes do caso: {descricao}. "
        + (f"Contexto do item do Azure DevOps: {contexto_texto} " if contexto_texto else "")
        + "Responda em no máximo 120 palavras, em 3 tópicos curtos: "
        "**O que está acontecendo**, **Impacto na entrega** e **O que fazer agora**. "
        "Use os números do caso, sem jargão e sem introdução."
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {"temperature": 0.3},
    }
    inicio = time.time()

    data = None
    ultimo_status = None
    for nome_modelo in MODELOS_GEMINI:
        restante = PRAZO_TOTAL_S - (time.time() - inicio)
        if restante < 3:
            raise RuntimeError(f"Prazo de {PRAZO_TOTAL_S}s esgotado antes de a IA responder.")
        # A chave vai no cabeçalho (não na URL), para nunca aparecer em mensagens de erro
        corpo = payload
        if "2.5" in nome_modelo:
            # Os modelos 2.5 "pensam" antes de responder; desligar deixa a resposta bem mais rápida
            corpo = {**payload, "generationConfig": {**payload["generationConfig"], "thinkingConfig": {"thinkingBudget": 0}}}
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{nome_modelo}:generateContent",
            json=corpo,
            headers={"x-goog-api-key": api_key},
            timeout=restante,
        )
        if response.status_code == 400 and corpo is not payload:
            # Modelo não aceitou a configuração de "pensamento": tenta de novo sem ela
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{nome_modelo}:generateContent",
                json=payload,
                headers={"x-goog-api-key": api_key},
                timeout=max(3, PRAZO_TOTAL_S - (time.time() - inicio)),
            )
        if response.status_code in (404, 429, 500, 503, 504):
            # 404 = modelo indisponível para a conta; 429/5xx = Gemini ocupado ou limite atingido.
            # Em todos esses casos vale tentar o próximo modelo (dentro do prazo).
            print(f"[ia] {nome_modelo} respondeu HTTP {response.status_code}; tentando o próximo modelo")
            ultimo_status = response.status_code
            continue
        if response.status_code != 200:
            raise RuntimeError(f"Gemini respondeu HTTP {response.status_code}: {response.text[:200]}")
        data = response.json()
        print(f"[ia] explicação gerada em {time.time() - inicio:.1f}s com {nome_modelo}")
        break
    if data is None:
        raise RuntimeError(f"Nenhum modelo do Gemini respondeu (último status: {ultimo_status}).")

    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini retornou resposta vazia.")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError("Gemini não retornou texto em content.parts.")

    return parts[0].get("text") or "Não foi possível extrair o texto da resposta da IA."


def explicar_alerta(tipo_problema, descricao, contexto=None):
    """Retorna uma explicação do alerta, preferencialmente com IA quando a chave estiver configurada."""
    if not api_key:
        return (
            f"O alerta de '{tipo_problema}' indica que a equipe precisa revisar o processo. "
            f"Sugestão inicial: confirmar responsável, estimativa e fluxo de trabalho antes da próxima entrega. "
            f"Detalhes: {descricao}"
        )

    try:
        if provider == "gemini" or model.lower().startswith("gemini"):
            return _gerar_resposta_gemini(tipo_problema, descricao, contexto=contexto)

        # Compatibilidade mínima com integração OpenAI antiga.
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        prompt = (
            "Você é um mentor de agilidade e gestão de projetos em português do Brasil. "
            f"Explique este problema de processo ágil e dê uma sugestão prática. "
            f"Tipo do alerta: {tipo_problema}. "
            f"Detalhes: {descricao}. "
            + (f"Contexto do item: {contexto} " if contexto else "")
        )
        resposta = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um mentor de agilidade e gestão de projetos em português do Brasil."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        return resposta.choices[0].message.content
    except Exception as exc:
        print(f"[ia] Falha ao gerar explicação: {exc!r}")  # detalhe só no terminal
        return "Não foi possível gerar a explicação da IA no momento. Sugestão prática: revisar responsável, estimativa e bloqueios do item."