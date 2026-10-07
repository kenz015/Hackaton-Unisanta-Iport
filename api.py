from dotenv import load_dotenv
load_dotenv()  # Carrega as variáveis do ficheiro .env

from flask import Flask, jsonify, request
from flask_cors import CORS
# Importa as funções corretas do teu devops_client.py
from devops_client import buscar_ids_sprint_atual, buscar_detalhes_itens, aplicar_tags_no_azure
from rules_engine import validar_processo, calcular_score_risco
from ia_service import explicar_alerta

app = Flask(__name__)
CORS(app)  # Permite que o Lovable aceda a esta API

@app.route("/api/sprint-data", methods=["GET"])
def get_sprint_data():
    try:
        # 1. Busca dados reais usando as funções existentes
        ids = buscar_ids_sprint_atual()
        itens = buscar_detalhes_itens(ids)
        
        # 2. Executa a validação de regras de processo
        df_alertas = validar_processo(itens)
        
        return jsonify({
            "status": "sucesso",
            "itens": itens,
            "total_alertas": len(df_alertas)
        })
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)