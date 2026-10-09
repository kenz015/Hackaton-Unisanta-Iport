"""
Monta a "fonte de dados" (Source) que o front do iCrew espera em /api/source.

O front calcula utilização, heatmap, timeline e avisos a partir de:
  people, sprints, teams, projects, workItems, absences, holidays

Regras importantes (o front depende delas):
  - Datas sempre no formato "yyyy-MM-dd" (sem hora).
  - person.id e workItems[].assigneeId são o GUID do Azure DevOps (estável).
  - person.email guarda o uniqueName em minúsculas, quando disponível.
  - state já traduzido para o padrão do front: Novo, Ativo, Em revisão, Bloqueado, Concluído.
  - Toda pessoa que tem tarefa atribuída aparece em people, mesmo sem capacidade cadastrada.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta

# Feriados nacionais/estaduais (SP) do período do hackathon em diante
FERIADOS = [
    {"date": "2026-10-12", "name": "Nossa Senhora Aparecida", "scope": "Nacional"},
    {"date": "2026-11-02", "name": "Finados", "scope": "Nacional"},
    {"date": "2026-11-15", "name": "Proclamação da República", "scope": "Nacional"},
    {"date": "2026-11-20", "name": "Dia da Consciência Negra", "scope": "Nacional"},
    {"date": "2026-12-25", "name": "Natal", "scope": "Nacional"},
]

CORES = ["--color-primary", "--color-brand-cyan", "--color-brand-turquoise", "--color-highlight", "--color-critical"]
HORAS_POR_DIA = 8

# Estados dos processos Basic, Agile e Scrum -> estado do front
ESTADOS_CONCLUIDO = {"done", "closed", "removed", "completed"}
ESTADOS_ATIVO = {"doing", "active", "in progress", "committed"}
ESTADOS_REVISAO = {"resolved"}


def dia(valor) -> str | None:
    """'2026-10-07T14:05:39.12Z' -> '2026-10-07'."""
    if not valor:
        return None
    return str(valor)[:10]


def mapear_estado(estado_azure: str | None, tags: str | None) -> str:
    estado = (estado_azure or "").strip().lower()
    if estado in ESTADOS_CONCLUIDO:
        return "Concluído"
    if "bloque" in (tags or "").lower() or "blocked" in (tags or "").lower():
        return "Bloqueado"
    if estado in ESTADOS_REVISAO:
        return "Em revisão"
    if estado in ESTADOS_ATIVO:
        return "Ativo"
    return "Novo"  # New, To Do, Approved...


def somar_dias_uteis(inicio: date, dias: int) -> date:
    """Data final contando 'dias' dias úteis a partir de 'inicio' (inclusive)."""
    atual = inicio
    while atual.weekday() >= 5:  # começou no fim de semana -> próxima segunda
        atual += timedelta(days=1)
    restantes = max(1, dias) - 1
    while restantes > 0:
        atual += timedelta(days=1)
        if atual.weekday() < 5:
            restantes -= 1
    return atual


def _pessoa_de(identidade: dict | None):
    if not isinstance(identidade, dict):
        return None
    guid = (identidade.get("id") or "").strip()
    email = (identidade.get("uniqueName") or "").strip().lower() or None
    nome = (
        identidade.get("displayName")
        or (email.split("@")[0] if email else None)
        or (guid[:8] if guid else None)
        or "Sem nome"
    )
    chave = guid or email
    if not chave:
        return None
    return chave, nome, email


def montar_source(client) -> dict:
    hoje = date.today()
    hoje_txt = hoje.isoformat()
    time_nome = client.team

    # 1) Sprints do time
    iteracoes = [
        it for it in client.buscar_iteracoes_do_time()
        if (it.get("attributes") or {}).get("startDate") and (it.get("attributes") or {}).get("finishDate")
    ]
    sprints = [
        {"id": it["id"], "name": it["name"], "start": dia(it["attributes"]["startDate"]), "end": dia(it["attributes"]["finishDate"])}
        for it in iteracoes
    ]
    sprint_por_caminho = {(it.get("path") or "").lower(): s for it, s in zip(iteracoes, sprints)}
    atual = next((s for it, s in zip(iteracoes, sprints) if (it.get("attributes") or {}).get("timeFrame") == "current"), None)
    if atual is None:
        atual = next((s for s in sprints if s["start"] <= hoje_txt <= s["end"]), None)

    # 2) Capacidade e folgas (sprint atual e próximas)
    pessoas: dict[str, dict] = {}
    ausencias: list[dict] = []
    relevantes = [s for s in sprints if s["end"] >= hoje_txt][:4]
    for s in relevantes:
        for membro in client.buscar_capacidade(s["id"]):
            info = _pessoa_de(membro.get("teamMember"))
            if not info:
                continue
            pid, nome, email = info
            atividades = membro.get("activities") or []
            horas_dia = sum((a.get("capacityPerDay") or 0) for a in atividades)
            if pid not in pessoas or (atual and s["id"] == atual["id"]):
                pessoas[pid] = {
                    "id": pid,
                    "email": email,
                    "name": nome or "Sem nome",
                    "role": next((a.get("name") for a in atividades if a.get("name")), None) or "Desenvolvimento",
                    "teamId": time_nome,
                    "dedication": min(1, horas_dia / HORAS_POR_DIA) if horas_dia > 0 else 1,
                }
            for folga in membro.get("daysOff") or []:
                ausencias.append({"personId": pid, "start": dia(folga.get("start")), "end": dia(folga.get("end")), "type": "Folga"})
        for folga in client.buscar_folgas_do_time(s["id"]):
            ausencias.append({"personId": "__time__", "start": dia(folga.get("start")), "end": dia(folga.get("end")), "type": "Folga"})

    # 3) Membros do time sem capacidade cadastrada
    for membro in client.buscar_membros_do_time():
        info = _pessoa_de(membro.get("identity"))
        if info and info[0] not in pessoas:
            pid, nome, email = info
            pessoas[pid] = {
                "id": pid,
                "email": email,
                "name": nome,
                "role": "Desenvolvimento",
                "teamId": time_nome,
                "dedication": 1,
            }

    # 4) Work items
    ids = client.buscar_ids_sprint_atual()
    itens = client.buscar_detalhes_itens(ids)
    work_items = []
    projetos: dict[str, dict] = {}
    for item in itens:
        f = item.get("fields", {})
        tipo = f.get("System.WorkItemType") or "Task"
        estado = mapear_estado(f.get("System.State"), f.get("System.Tags"))
        info = _pessoa_de(f.get("System.AssignedTo"))
        assignee = info[0] if info else None
        if info and assignee not in pessoas:  # tem tarefa mas não está no time: entra mesmo assim
            pid, nome, email = info
            pessoas[pid] = {
                "id": pid,
                "email": email,
                "name": nome,
                "role": "Desenvolvimento",
                "teamId": time_nome,
                "dedication": 1,
            }

        projeto = (f.get("System.AreaPath") or client.project).split("\\")[-1]
        if projeto not in projetos:
            projetos[projeto] = {"id": projeto, "name": projeto, "code": projeto[:3].upper(), "colorVar": CORES[len(projetos) % len(CORES)]}

        sprint = sprint_por_caminho.get((f.get("System.IterationPath") or "").lower())
        horas = f.get("Microsoft.VSTS.Scheduling.RemainingWork")
        if horas is None:
            horas = f.get("Microsoft.VSTS.Scheduling.OriginalEstimate")

        # Datas: campo do item > datas da sprint > estimativa a partir de hoje
        inicio = dia(f.get("Microsoft.VSTS.Scheduling.StartDate")) or (sprint["start"] if sprint else None)
        fim = dia(f.get("Microsoft.VSTS.Scheduling.TargetDate") or f.get("Microsoft.VSTS.Scheduling.DueDate")) or (sprint["end"] if sprint else None)
        if not inicio or not fim:
            if estado == "Concluído":
                inicio = inicio or dia(f.get("System.CreatedDate")) or hoje_txt
                fim = fim or dia(f.get("Microsoft.VSTS.Common.ClosedDate") or f.get("System.ChangedDate")) or inicio
            else:
                # Item aberto sem datas: começa hoje e dura o necessário para as horas (8h/dia)
                base = date.fromisoformat(inicio) if inicio else hoje
                base = max(base, hoje)
                dias = math.ceil((horas or 0) / HORAS_POR_DIA) if horas else 5
                inicio = base.isoformat()
                fim = fim or somar_dias_uteis(base, dias).isoformat()
        if fim < inicio:
            fim = inicio

        work_items.append({
            "id": item.get("id"),
            "title": f.get("System.Title") or f"#{item.get('id')}",
            "type": tipo,
            "state": estado,
            "azureState": f.get("System.State"),
            "parentId": f.get("System.Parent"),
            "assigneeId": assignee,
            "projectId": projeto,
            "sprintId": sprint["id"] if sprint else None,
            "priority": int(f.get("Microsoft.VSTS.Common.Priority") or 2),
            "estimateHours": horas,
            "remainingHours": f.get("Microsoft.VSTS.Scheduling.RemainingWork"),
            "start": inicio,
            "end": fim,
            "lastUpdated": dia(f.get("System.ChangedDate")) or hoje_txt,
        })

    # Folga do time vale para todo mundo (inclusive quem entrou pelas tarefas)
    folgas_time = [a for a in ausencias if a["personId"] == "__time__"]
    ausencias = [a for a in ausencias if a["personId"] != "__time__" and a["start"] and a["end"]]
    for folga in folgas_time:
        if folga["start"] and folga["end"]:
            for pid in pessoas:
                ausencias.append({**folga, "personId": pid})

    return {
        "origin": "azure",
        "today": hoje_txt,
        "currentSprintId": atual["id"] if atual else "",
        "people": list(pessoas.values()),
        "projects": list(projetos.values()),
        "sprints": sprints,
        "teams": [{"id": time_nome, "name": time_nome}],
        "workItems": work_items,
        "absences": ausencias,
        "holidays": FERIADOS,
        "burnRatio": [],
    }