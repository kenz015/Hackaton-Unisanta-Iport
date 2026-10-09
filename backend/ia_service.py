import os
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

api_key = (os.getenv("AI_API_KEY") or "").strip()
model = (os.getenv("AI_MODEL") or "gemini-2.0-flash").strip()
provider = (os.getenv("AI_PROVIDER") or "gemini").strip().lower()


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
        "Responda como se estivesse explicando o caso para uma liderança executiva, de forma clara, objetiva e didática. "
        f"Tipo do alerta: {tipo_problema}. "
        f"Detalhes do caso: {descricao}. "
        + (f"Contexto do item do Azure DevOps: {contexto_texto} " if contexto_texto else "")
        + "Estrutura a resposta em 5 partes: 1) Resumo executivo; 2) Causa provável; 3) Impacto no time e na entrega; 4) Risco e prioridade; 5) Recomendação prática e imediata. "
        "Use linguagem de gestor, explique o problema sem jargão excessivo e mantenha uma explicação mais lenta e completa do que uma resposta curta."
    )

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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

    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()

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
        return f"Não foi possível gerar a explicação da IA no momento: {exc}. Sugestão prática: revisar responsável, estimativa e bloqueios do item."