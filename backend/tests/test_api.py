import pytest

import ia_service
from api import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"


def test_explicar_alerta_usa_gemini_quando_configurado(monkeypatch):
    monkeypatch.setattr(ia_service, "api_key", "abc123")
    monkeypatch.setattr(ia_service, "model", "gemini-1.5-flash")
    monkeypatch.setattr(
        ia_service,
        "_gerar_resposta_gemini",
        lambda *args, **kwargs: "Resumo do caso: há risco de atraso e bloqueio de entrega.",
    )

    resposta = ia_service.explicar_alerta("bloqueio", "A equipe não definiu o escopo.")

    assert "Resumo do caso" in resposta


# ---- deploy: senha compartilhada entre o site e a API ----

def test_sem_segredo_configurado_api_funciona_como_antes(client, monkeypatch):
    monkeypatch.delenv("API_SHARED_SECRET", raising=False)
    r = client.post("/api/workitems/5/tags", json={"tags": ["a;b"]})
    assert r.status_code == 400  # chegou na validação normal (não foi barrado)


def test_com_segredo_exige_o_cabecalho(client, monkeypatch):
    monkeypatch.setenv("API_SHARED_SECRET", "segredo-de-teste")
    assert client.get("/api/source").status_code == 401
    assert client.get("/api/source", headers={"X-ICrew-Key": "errado"}).status_code == 401
    assert client.get("/api/health").status_code == 200  # o despertador continua funcionando
    r = client.post("/api/workitems/5/tags", json={"tags": ["a;b"]}, headers={"X-ICrew-Key": "segredo-de-teste"})
    assert r.status_code == 400  # passou pela senha e caiu na validação


def test_gemini_manda_chave_no_cabecalho_e_tenta_outro_modelo(monkeypatch):
    chamadas = []

    class Resp:
        def __init__(self, status):
            self.status_code = status

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Resumo executivo ok"}]}}]}

    def falso_post(url, json=None, headers=None, timeout=None):
        chamadas.append((url, headers))
        return Resp(404 if len(chamadas) == 1 else 200)

    monkeypatch.setattr(ia_service, "api_key", "chave-secreta")
    monkeypatch.setattr(ia_service.requests, "post", falso_post)
    texto = ia_service._gerar_resposta_gemini("sobrecarga", "Ana com 130%")
    assert texto == "Resumo executivo ok" and len(chamadas) == 2
    assert all("chave-secreta" not in url for url, _ in chamadas)  # chave nunca na URL
    assert chamadas[0][1]["x-goog-api-key"] == "chave-secreta"


def test_erro_da_ia_nao_vaza_detalhes(monkeypatch):
    monkeypatch.setattr(ia_service, "api_key", "chave-secreta")

    def explode(*a, **k):
        raise RuntimeError("https://exemplo?key=chave-secreta")

    monkeypatch.setattr(ia_service, "_gerar_resposta_gemini", explode)
    resposta = ia_service.explicar_alerta("sobrecarga", "x")
    assert "chave-secreta" not in resposta and "Não foi possível" in resposta
