import pandas as pd

# Pesos para o cálculo do Score de Risco da Sprint[cite: 34]
PESOS = {
    "sobrecarga": 25, "sem_dono": 15, "carry_over": 15, 
    "wip": 10, "bugs": 10, "sem_estimativa": 10, 
    "bus_factor": 10, "parados": 5
}

def validar_processo(itens):
    alertas = []
    for item in itens:
        campos = item.get("fields", {})
        item_id = item["id"]
        tipo = campos.get("System.WorkItemType", "")
        estado = campos.get("System.State", "")
        
        # V01: Item ativo sem responsável[cite: 13]
        if "System.AssignedTo" not in campos:
            alertas.append({"id": item_id, "regra": "V01", "gravidade": "Alta", "mensagem": f"{tipo} {item_id} sem responsável."})
            
        # V03: Item sem estimativa[cite: 13]
        esforco = campos.get("Microsoft.VSTS.Scheduling.Effort")
        horas = campos.get("Microsoft.VSTS.Scheduling.RemainingWork")
        if esforco is None and horas is None:
            alertas.append({"id": item_id, "regra": "V03", "gravidade": "Média", "mensagem": f"{tipo} {item_id} sem estimativa de esforço/horas."})
            
    return pd.DataFrame(alertas) if alertas else pd.DataFrame(columns=["id", "regra", "gravidade", "mensagem"])

def calcular_score_risco(metricas_normalizadas):
    # métricas entre 0 e 1, onde 1 é crítico[cite: 34]
    score = sum(PESOS[k] * min(1.0, max(0.0, metricas_normalizadas.get(k, 0))) for k in PESOS)
    
    if score <= 30: faixa = "Verde (Baixo)"
    elif score <= 60: faixa = "Amarelo (Médio)"
    else: faixa = "Vermelho (Alto)" #[cite: 34]
    
    return score, faixa