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
