"""Testa o Créu quando o Gemini está sobrecarregado (503), sem chamar a API de verdade."""
import os
import sys

import pytest
from google.genai import errors

os.environ.setdefault("GEMINI_API_KEY", "chave-de-teste")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as creu  # noqa: E402


def erro(codigo, status):
    return errors.APIError(codigo, {"error": {"code": codigo, "message": "teste", "status": status}})


class Resposta:
    text = "Olá! Posso ajudar com a capacidade da equipe."


class FakeModels:
    def __init__(self, roteiro):
        self.roteiro = list(roteiro)  # lista de exceções/respostas, consumidas em ordem
        self.chamadas = []

    def generate_content(self, model, contents, config):
        self.chamadas.append(model)
        proximo = self.roteiro.pop(0) if self.roteiro else erro(503, "UNAVAILABLE")
        if isinstance(proximo, Exception):
            raise proximo
        return proximo


@pytest.fixture
def chat(monkeypatch):
    monkeypatch.setattr(creu, "ESPERA_INICIAL_S", 0)  # teste rápido, sem esperar
    monkeypatch.setattr(creu, "contexto_da_equipe", lambda: "Daniela: 120% de utilização")

    def rodar(roteiro):
        fake = FakeModels(roteiro)

        class FakeClient:
            models = fake

        monkeypatch.setattr(creu, "client", FakeClient())
        r = creu.app.test_client().post("/api/chatbot", json={"mensagem": "quem está sobrecarregado?"})
        return r, fake

    return rodar


def test_503_depois_sucesso_na_segunda_tentativa(chat):
    r, fake = chat([erro(503, "UNAVAILABLE"), Resposta()])
    assert r.status_code == 200
    assert "capacidade" in r.get_json()["resposta"]
    assert fake.chamadas[0] == fake.chamadas[1]  # tentou o mesmo modelo de novo


def test_modelo_ocupado_passa_para_o_proximo(chat):
    r, fake = chat([erro(503, "UNAVAILABLE"), erro(503, "UNAVAILABLE"), Resposta()])
    assert r.status_code == 200
    assert fake.chamadas[2] != fake.chamadas[0]  # trocou de modelo


def test_tudo_ocupado_mostra_mensagem_amigavel(chat):
    r, _ = chat([])  # sempre 503
    assert r.status_code == 503
    texto = r.get_json()["resposta"]
    assert "UNAVAILABLE" not in texto and "{" not in texto  # nada de erro cru para o usuário


def test_modelo_inexistente_tenta_o_proximo(chat):
    r, fake = chat([erro(404, "NOT_FOUND"), Resposta()])
    assert r.status_code == 200 and len(fake.chamadas) == 2


def test_chave_invalida_nao_fica_tentando(chat):
    r, fake = chat([erro(400, "INVALID_ARGUMENT")])
    assert r.status_code == 502 and len(fake.chamadas) == 1


def test_dados_da_equipe_vao_para_a_ia(chat, monkeypatch):
    capturado = {}

    class Espiao(FakeModels):
        def generate_content(self, model, contents, config):
            capturado["instrucoes"] = config.system_instruction
            capturado["conversa"] = contents
            return Resposta()

    class FakeClient:
        models = Espiao([])

    monkeypatch.setattr(creu, "client", FakeClient())
    historico = [{"texto": "Olá! Sou o Créu.", "isUser": False}, {"texto": "quem está sobrecarregado?", "isUser": True}]
    r = creu.app.test_client().post("/api/chatbot", json={"mensagem": "e quem tem folga?", "historico": historico})
    assert r.status_code == 200
    assert "Daniela: 120%" in capturado["instrucoes"]
    assert [m["role"] for m in capturado["conversa"]] == ["model", "user", "user"]


def test_resumo_da_equipe_com_dados_do_azure():
    from test_source import FakeClient
    from source_builder import montar_source
    from team_context import resumir

    texto = resumir(montar_source(FakeClient()))
    assert "Gustavo Kenzo" in texto and "Daniela Varela" in texto
    assert "SEM RESPONSÁVEL" in texto  # a Task #1 não tem dono
    assert "utilização" in texto
