import os
from pathlib import Path
from urllib.parse import quote

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


class AzureDevOpsClient:
    def __init__(self):
        self.org = (os.getenv("ADO_ORG") or "").strip()
        self.project = (os.getenv("ADO_PROJECT") or "").strip()
        self.pat = (os.getenv("ADO_PAT") or "").strip()
        self.team = (os.getenv("ADO_TEAM") or "").strip() or f"{self.project} Team"

        if not self.org or not self.project or not self.pat:
            raise ValueError(
                "Configure ADO_ORG, ADO_PROJECT e ADO_PAT no arquivo .env antes de usar o backend do Azure DevOps."
            )

        self.base_url = f"https://dev.azure.com/{self.org}/{self.project}/_apis"
        self.auth = ("", self.pat)
        self.api_version = "api-version=7.1"

    def _url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.base_url}/{path.lstrip('/')}"

    def _get(self, path: str, **kwargs):
        response = requests.get(self._url(path), auth=self.auth, **kwargs)
        response.raise_for_status()
        return response.json()

    def _post(self, path: str, json=None, **kwargs):
        response = requests.post(self._url(path), json=json, auth=self.auth, **kwargs)
        response.raise_for_status()
        return response.json()

    def _patch(self, path: str, payload, **kwargs):
        response = requests.patch(self._url(path), json=payload, auth=self.auth, **kwargs)
        response.raise_for_status()
        return response.json()

    # ---- Time, sprints e capacidade (usados pelo /api/source) ----

    def _team_url(self, path: str) -> str:
        """URL de recursos do time: dev.azure.com/{org}/{project}/{team}/_apis/..."""
        return (
            f"https://dev.azure.com/{quote(self.org)}/{quote(self.project)}/{quote(self.team)}/_apis/"
            f"{path.lstrip('/')}"
        )

    def buscar_iteracoes_do_time(self):
        """Sprints configuradas para o time (pode vir vazio se o time não tiver sprints)."""
        try:
            payload = self._get(self._team_url(f"work/teamsettings/iterations?{self.api_version}"))
            return payload.get("value", [])
        except requests.HTTPError:
            return []

    def buscar_capacidade(self, iteration_id: str):
        """Capacidade (horas/dia e folgas) de cada membro numa sprint."""
        try:
            payload = self._get(
                self._team_url(f"work/teamsettings/iterations/{iteration_id}/capacities?{self.api_version}")
            )
            return payload.get("teamMembers") or payload.get("value") or []
        except requests.HTTPError:
            return []

    def buscar_folgas_do_time(self, iteration_id: str):
        """Dias sem expediente do time inteiro numa sprint."""
        try:
            payload = self._get(
                self._team_url(f"work/teamsettings/iterations/{iteration_id}/teamdaysoff?{self.api_version}")
            )
            return payload.get("daysOff", [])
        except requests.HTTPError:
            return []

    def buscar_membros_do_time(self):
        """Membros do time (para quem não tem capacidade cadastrada)."""
        url = (
            f"https://dev.azure.com/{quote(self.org)}/_apis/projects/{quote(self.project)}"
            f"/teams/{quote(self.team)}/members?{self.api_version}"
        )
        try:
            payload = self._get(url)
            return payload.get("value", [])
        except requests.HTTPError:
            return []

    def buscar_ids_sprint_atual(self):
        wiql = {
            "query": "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] <> 'Removed'"
        }
        payload = self._post(f"wit/wiql?{self.api_version}", json=wiql)
        return [w["id"] for w in payload.get("workItems", [])]

    def buscar_detalhes_itens(self, ids):
        if not ids:
            return []

        itens = []
        for i in range(0, len(ids), 200):  # a API aceita no máximo 200 ids por chamada
            lote = ",".join(map(str, ids[i:i + 200]))
            url = f"wit/workitems?ids={lote}&$expand=relations&{self.api_version}"
            itens.extend(self._get(url).get("value", []))
        return itens

    def aplicar_tags_no_azure(self, item_id, novas_tags, so_simular=True):
        url_get = f"wit/workitems/{item_id}?{self.api_version}"
        item = self._get(url_get)
        texto_atual = item.get("fields", {}).get("System.Tags", "")
        atuais = [t.strip() for t in texto_atual.split(";") if t.strip()]

        todas_tags = atuais + [t for t in novas_tags if t not in atuais]
        corpo = [{"op": "add", "path": "/fields/System.Tags", "value": "; ".join(todas_tags)}]

        url_patch = f"wit/workitems/{item_id}?{self.api_version}"
        if so_simular:
            url_patch += "&validateOnly=true"

        response = requests.patch(
            self._url(url_patch),
            json=corpo,
            auth=self.auth,
            headers={"Content-Type": "application/json-patch+json"},
        )

        if response.status_code not in (200, 204):
            raise RuntimeError(f"Azure DevOps recusou a atualização de tags: {response.text}")

        return response.status_code in (200, 204), todas_tags


def buscar_ids_sprint_atual():
    return AzureDevOpsClient().buscar_ids_sprint_atual()


def buscar_detalhes_itens(ids):
    return AzureDevOpsClient().buscar_detalhes_itens(ids)


def aplicar_tags_no_azure(item_id, novas_tags, so_simular=True):
    return AzureDevOpsClient().aplicar_tags_no_azure(item_id, novas_tags, so_simular=so_simular)
