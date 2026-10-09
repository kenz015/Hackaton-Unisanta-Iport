import hmac
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from devops_client import AzureDevOpsClient
from ia_service import explicar_alerta
from rules_engine import validar_processo
from source_builder import montar_source

app = Flask(__name__)
# Só o próprio site do iCrew pode chamar esta API pelo navegador
ORIGENS_PERMITIDAS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "http://127.0.0.1:8080,http://localhost:8080").split(",") if o.strip()
]
CORS(app, resources={r"/api/*": {"origins": ORIGENS_PERMITIDAS}})


def erro_interno(contexto: str, exc: Exception):
    """Registra o detalhe no terminal e devolve uma mensagem genérica (sem dados internos)."""
    print(f"[api] {contexto}: {exc!r}")
    return jsonify({"status": "erro", "mensagem": f"{contexto}. Veja o terminal do backend para detalhes."}), 500


@app.before_request
def exigir_senha_compartilhada():
    """
    No deploy, a API fica na internet: só o servidor do site (que já confere o login)
    pode chamá-la, mandando a senha API_SHARED_SECRET no cabeçalho X-ICrew-Key.
    Sem API_SHARED_SECRET configurada (uso local), nada muda.
    """
    segredo = (os.getenv("API_SHARED_SECRET") or "").strip()
    if not segredo or request.method == "OPTIONS" or request.path == "/api/health":
        return None
    enviado = request.headers.get("X-ICrew-Key", "")
    if not hmac.compare_digest(enviado.encode(), segredo.encode()):
        return jsonify({"status": "erro", "mensagem": "Acesso negado."}), 401
    return None


@app.get("/api/health")
def health():
    configured = bool(os.getenv("ADO_ORG") and os.getenv("ADO_PROJECT") and os.getenv("ADO_PAT"))
    return jsonify({
        "status": "ok",
        "service": "clarity-first-backend",
        "ado_configured": configured,
    })


@app.get("/api/sprint-data")
def get_sprint_data():
    try:
        client = AzureDevOpsClient()
        ids = client.buscar_ids_sprint_atual()
        itens = client.buscar_detalhes_itens(ids)
        df_alertas = validar_processo(itens)

        return jsonify({
            "status": "sucesso",
            "itens": itens,
            "total_alertas": len(df_alertas),
            "alertas": df_alertas.to_dict(orient="records"),
        })
    except ValueError as exc:
        return jsonify({"status": "erro", "mensagem": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - safety net for Azure API issues
        return erro_interno("Falha ao consultar Azure DevOps", exc)


@app.get("/api/alerts")
def get_alerts():
    try:
        client = AzureDevOpsClient()
        ids = client.buscar_ids_sprint_atual()
        itens = client.buscar_detalhes_itens(ids)
        df_alertas = validar_processo(itens)
        return jsonify({
            "status": "sucesso",
            "alertas": df_alertas.to_dict(orient="records"),
        })
    except ValueError as exc:
        return jsonify({"status": "erro", "mensagem": str(exc)}), 500
    except Exception as exc:
        return erro_interno("Falha ao validar itens", exc)


@app.get("/api/source")
def get_source():
    """Fonte de dados completa para o front (pessoas, sprints, capacidade, folgas e work items)."""
    try:
        return jsonify(montar_source(AzureDevOpsClient()))
    except ValueError as exc:
        return jsonify({"status": "erro", "mensagem": str(exc)}), 500
    except Exception as exc:
        return erro_interno("Falha ao montar fonte de dados", exc)


@app.route("/api/workitems/<int:item_id>/tags", methods=["POST"])
def update_tags(item_id):
    payload = request.get_json(silent=True) or {}
    tags = payload.get("tags") or []
    # Validação: lista curta de textos simples (o ";" separa tags no Azure)
    if not isinstance(tags, list) or len(tags) > 10 or not all(isinstance(t, str) and 0 < len(t.strip()) <= 50 and ";" not in t for t in tags):
        return jsonify({"status": "erro", "mensagem": "Tags inválidas: envie até 10 textos de até 50 caracteres, sem ';'."}), 400
    tags = [t.strip() for t in tags]
    validate_only = payload.get("validate_only", True) is not False

    try:
        client = AzureDevOpsClient()
        ok, final_tags = client.aplicar_tags_no_azure(item_id, tags, so_simular=validate_only)
        return jsonify({
            "status": "sucesso" if ok else "simulado",
            "item_id": item_id,
            "tags": final_tags,
            "validate_only": validate_only,
        })
    except ValueError as exc:
        return jsonify({"status": "erro", "mensagem": str(exc)}), 500
    except Exception as exc:
        return erro_interno("Falha ao atualizar tags", exc)


@app.route("/api/ai/explain", methods=["POST"])
def explain_alert():
    payload = request.get_json(silent=True) or {}
    problema = payload.get("type") or payload.get("problema") or "alerta de processo"
    descricao = payload.get("description") or payload.get("descricao") or "Sem descrição detalhada."
    contexto = payload.get("contexto") or payload.get("context") or payload.get("item") or payload.get("work_item")
    item_id = payload.get("item_id") or payload.get("workItemId")
    problema, descricao = str(problema)[:100], str(descricao)[:2000]
    try:
        item_id = int(item_id) if item_id is not None else None
    except (TypeError, ValueError):
        item_id = None

    if item_id is not None:
        try:
            client = AzureDevOpsClient()
            itens = client.buscar_detalhes_itens([int(item_id)])
            if itens:
                contexto = contexto or itens[0]
        except Exception:
            contexto = contexto

    texto = explicar_alerta(problema, descricao, contexto=contexto)
    return jsonify({"status": "sucesso", "resposta": texto, "contexto": contexto})


if __name__ == "__main__":
    # Escuta só neste computador: quem chama a API é o servidor do site, que já confere o login
    app.run(host=os.getenv("API_HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")