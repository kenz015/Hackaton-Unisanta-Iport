import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from devops_client import AzureDevOpsClient
from ia_service import explicar_alerta
from rules_engine import validar_processo
from source_builder import montar_source

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


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
        return jsonify({"status": "erro", "mensagem": f"Falha ao consultar Azure DevOps: {exc}"}), 500


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
        return jsonify({"status": "erro", "mensagem": f"Falha ao validar itens: {exc}"}), 500


@app.get("/api/source")
def get_source():
    """Fonte de dados completa para o front (pessoas, sprints, capacidade, folgas e work items)."""
    try:
        return jsonify(montar_source(AzureDevOpsClient()))
    except ValueError as exc:
        return jsonify({"status": "erro", "mensagem": str(exc)}), 500
    except Exception as exc:
        return jsonify({"status": "erro", "mensagem": f"Falha ao montar fonte de dados: {exc}"}), 500


@app.route("/api/workitems/<int:item_id>/tags", methods=["POST"])
def update_tags(item_id):
    payload = request.get_json(silent=True) or {}
    tags = payload.get("tags") or []
    validate_only = bool(payload.get("validate_only", True))

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
        return jsonify({"status": "erro", "mensagem": f"Falha ao atualizar tags: {exc}"}), 500


@app.route("/api/ai/explain", methods=["POST"])
def explain_alert():
    payload = request.get_json(silent=True) or {}
    problema = payload.get("type") or payload.get("problema") or "alerta de processo"
    descricao = payload.get("description") or payload.get("descricao") or "Sem descrição detalhada."
    contexto = payload.get("contexto") or payload.get("context") or payload.get("item") or payload.get("work_item")
    item_id = payload.get("item_id") or payload.get("workItemId")

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
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")