import os
import requests
from dotenv import load_dotenv

load_dotenv()

ORG = os.getenv("ADO_ORG")
PROJECT = os.getenv("ADO_PROJECT")
PAT = os.getenv("ADO_PAT")

BASE_URL = f"https://dev.azure.com/{ORG}/{PROJECT}/_apis"
AUTH = ("", PAT) # Usuário vazio, PAT como senha[cite: 33]
API_VER = "api-version=7.1"

def buscar_ids_sprint_atual():
    # Consulta WIQL para buscar itens ativos[cite: 33]
    wiql = {
        "query": "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] <> 'Removed'"
    }
    r = requests.post(f"{BASE_URL}/wit/wiql?{API_VER}", json=wiql, auth=AUTH)
    if r.status_code == 200:
        return [w["id"] for w in r.json()["workItems"]]
    return []

def buscar_detalhes_itens(ids):
    if not ids: return []
    # Busca itens em lotes de no máximo 200 por chamada[cite: 33]
    lote = ",".join(map(str, ids[:200]))
    url = f"{BASE_URL}/wit/workitems?ids={lote}&$expand=relations&{API_VER}"
    r = requests.get(url, auth=AUTH)
    if r.status_code == 200:
        return r.json()["value"]
    return []

def aplicar_tags_no_azure(item_id, novas_tags, so_simular=True):
    # Pega as tags atuais e adiciona as novas para não sobrescrever[cite: 33]
    url_get = f"{BASE_URL}/wit/workitems/{item_id}?{API_VER}"
    item = requests.get(url_get, auth=AUTH).json()
    texto_atual = item["fields"].get("System.Tags", "")
    atuais = [t.strip() for t in texto_atual.split(";") if t.strip()]
    
    todas_tags = atuais + [t for t in novas_tags if t not in atuais]
    corpo = [{"op": "add", "path": "/fields/System.Tags", "value": "; ".join(todas_tags)}]
    
    url_patch = f"{BASE_URL}/wit/workitems/{item_id}?{API_VER}"
    if so_simular:
        url_patch += "&validateOnly=true" # Modo dry-run[cite: 33]
        
    r = requests.patch(url_patch, json=corpo, auth=AUTH, headers={"Content-Type": "application/json-patch+json"})
    return r.status_code == 200, todas_tags