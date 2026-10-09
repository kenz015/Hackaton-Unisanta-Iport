"""
Confere no Supabase se o token de login enviado pelo front é válido.

O front manda o cabeçalho "Authorization: Bearer <token da sessão>". Aqui
perguntamos ao Supabase quem é o dono do token; se ele não responder 200,
o pedido é recusado. Tokens válidos ficam 60s em cache para não consultar
o Supabase a cada mensagem.
"""
from __future__ import annotations

import hashlib
import os
import time

import requests

# Valores PÚBLICOS do projeto Supabase do iCrew (os mesmos do front; não são segredo).
_URL_PADRAO = "https://sapugrjzkiuglcyfhkwq.supabase.co"
_CHAVE_PADRAO = "sb_publishable_jHnUinmhJH982AKRFRMYcA_GImiXvUg"

CACHE_SEGUNDOS = 60
_validos: dict[str, float] = {}  # hash do token -> válido até


def _config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or _URL_PADRAO
    chave = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY") or _CHAVE_PADRAO
    return url.strip().rstrip("/"), chave.strip()


def token_da_requisicao(req) -> str | None:
    """Pega o token do cabeçalho Authorization: Bearer ..."""
    cabecalho = req.headers.get("Authorization", "")
    if not cabecalho.lower().startswith("bearer "):
        return None
    token = cabecalho[7:].strip()
    return token if 20 <= len(token) <= 4096 else None


def login_valido(token: str | None) -> bool:
    if not token:
        return False
    chave_cache = hashlib.sha256(token.encode()).hexdigest()
    agora = time.time()
    if _validos.get(chave_cache, 0) > agora:
        return True
    url, chave = _config()
    try:
        resposta = requests.get(
            f"{url}/auth/v1/user",
            headers={"apikey": chave, "Authorization": f"Bearer {token}"},
            timeout=8,
        )
    except requests.RequestException as exc:
        print(f"Não consegui validar o login no Supabase: {exc}")
        return False
    if resposta.status_code != 200:
        return False
    if len(_validos) > 500:
        _validos.clear()
    _validos[chave_cache] = agora + CACHE_SEGUNDOS
    return True
