"""Testa o /api/source com dados no formato real do Azure DevOps (processo Basic)."""
from datetime import date, timedelta

import api
from source_builder import mapear_estado


class FakeClient:
    team = "iCrew Team"
    project = "iCrew"

    def buscar_iteracoes_do_time(self):
        hoje = date.today()
        fim = (hoje + timedelta(days=13)).isoformat()
        return [{"id": "it-1", "name": "Sprint 1", "path": "iCrew\\Sprint 1",
                 "attributes": {"startDate": f"{hoje.isoformat()}T00:00:00Z", "finishDate": f"{fim}T00:00:00Z", "timeFrame": "current"}}]

    def buscar_capacidade(self, iteration_id):
        return [{"teamMember": {"displayName": "Daniela Varela", "uniqueName": "DA252724@alunos.unisanta.br"},
                 "activities": [{"capacityPerDay": 4, "name": "Development"}],
                 "daysOff": [{"start": "2026-10-20T00:00:00Z", "end": "2026-10-21T00:00:00Z"}]}]

    def buscar_folgas_do_time(self, iteration_id):
        return [{"start": "2026-10-12T00:00:00Z", "end": "2026-10-12T00:00:00Z"}]

    def buscar_membros_do_time(self):
        return [{"identity": {"displayName": "Gustavo Kenzo", "uniqueName": "gs255041@alunos.unisanta.br"}}]

    def buscar_ids_sprint_atual(self):
        return [1, 2, 3, 4]

    def buscar_detalhes_itens(self, ids):
        return [
            {"id": 1, "fields": {"System.Title": "Refatorar motor", "System.WorkItemType": "Task", "System.State": "Doing",
                                 "System.AreaPath": "iCrew", "System.IterationPath": "iCrew",
                                 "Microsoft.VSTS.Scheduling.RemainingWork": 28,
                                 "System.CreatedDate": "2026-10-07T14:05:39.12Z", "System.ChangedDate": "2026-10-08T00:02:55.13Z"}},
            {"id": 2, "fields": {"System.Title": "Bug login", "System.WorkItemType": "Issue", "System.State": "Doing",
                                 "System.AssignedTo": {"displayName": "Daniela Varela", "uniqueName": "da252724@alunos.unisanta.br"},
                                 "System.AreaPath": "iCrew", "System.IterationPath": "iCrew\\Sprint 1",
                                 "System.CreatedDate": "2026-10-07T14:05:55.873Z", "System.ChangedDate": "2026-10-07T23:59:42.257Z"}},
            {"id": 4, "fields": {"System.Title": "Relatório PDF", "System.WorkItemType": "Issue", "System.State": "Done",
                                 "System.AssignedTo": {"displayName": "Daniel Assis", "uniqueName": "dv253019@alunos.unisanta.br"},
                                 "System.AreaPath": "iCrew", "System.CreatedDate": "2026-10-07T16:53:48Z", "System.ChangedDate": "2026-10-08T00:02:32Z"}},
            {"id": 3, "fields": {"System.Title": "Pipeline CI", "System.WorkItemType": "Task", "System.State": "To Do",
                                 "System.AssignedTo": {"displayName": "Gustavo Kenzo", "uniqueName": "gs255041@alunos.unisanta.br"},
                                 "System.AreaPath": "iCrew", "Microsoft.VSTS.Scheduling.RemainingWork": 6,
                                 "System.CreatedDate": "2026-10-07T17:10:44Z", "System.ChangedDate": "2026-10-08T00:07:05Z"}},
        ]


def test_source_completo(monkeypatch):
    monkeypatch.setattr(api, "AzureDevOpsClient", lambda: FakeClient())
    data = api.app.test_client().get("/api/source").get_json()

    ids = {p["id"] for p in data["people"]}
    # pessoas vêm da capacidade, dos membros do time e dos responsáveis das tarefas (tudo em minúsculas)
    assert {"da252724@alunos.unisanta.br", "gs255041@alunos.unisanta.br", "dv253019@alunos.unisanta.br"} <= ids
    assert all(w["assigneeId"] in ids for w in data["workItems"] if w["assigneeId"])

    for w in data["workItems"]:
        assert len(w["start"]) == 10 and len(w["end"]) == 10  # yyyy-MM-dd
        assert w["start"] <= w["end"]

    estados = {w["id"]: w["state"] for w in data["workItems"]}
    assert estados == {1: "Ativo", 2: "Ativo", 3: "Novo", 4: "Concluído"}
    assert data["currentSprintId"] == "it-1"
    assert next(w for w in data["workItems"] if w["id"] == 2)["sprintId"] == "it-1"
    assert data["projects"] and data["teams"] and data["holidays"]
    # folga do time (12/10) vale para todas as pessoas
    assert sum(1 for a in data["absences"] if a["start"] == "2026-10-12") == len(data["people"])


def test_mapear_estado():
    assert mapear_estado("Done", "") == "Concluído"
    assert mapear_estado("To Do", "bloqueio") == "Bloqueado"
    assert mapear_estado("Active", None) == "Ativo"
    assert mapear_estado("New", None) == "Novo"
