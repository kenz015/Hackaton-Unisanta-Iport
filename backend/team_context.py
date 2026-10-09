"""
Resumo dos dados da equipe (vindos do Azure DevOps) para o Créu usar nas respostas.

Usa o mesmo montar_source() do /api/source, então o chatbot enxerga exatamente
os mesmos números que as telas do iCrew. O resumo fica em cache por 2 minutos
para não consultar o Azure a cada mensagem.
"""
from __future__ import annotations

import threading
import time
from datetime import date, timedelta

CACHE_SEGUNDOS = 120
HORAS_POR_DIA = 8
TIPOS_COM_HORAS = {"Task", "Bug"}
_cache: dict = {"quando": 0.0, "texto": None}
_trava = threading.Lock()
_atualizador = {"ativo": False}


def _dias_uteis(inicio: date, fim: date) -> list[date]:
    dias, atual = [], inicio
    while atual <= fim:
        if atual.weekday() < 5:
            dias.append(atual)
        atual += timedelta(days=1)
    return dias


def _ausente(pid: str, dia: str, ausencias: list[dict]) -> bool:
    return any(a["personId"] == pid and a["start"] <= dia <= a["end"] for a in ausencias)


def resumir(source: dict, hoje: date | None = None) -> str:
    """Transforma a fonte de dados num texto curto que cabe no prompt da IA."""
    hoje = hoje or date.today()
    janela = _dias_uteis(hoje, hoje + timedelta(days=13))  # próximas 2 semanas
    janela_txt = [d.isoformat() for d in janela]
    feriados = {h["date"]: h["name"] for h in source.get("holidays", [])}
    ausencias = source.get("absences", [])
    pessoas = {p["id"]: p for p in source.get("people", [])}
    itens = source.get("workItems", [])
    abertos = [w for w in itens if w.get("state") != "Concluído"]

    linhas = [f"Data de hoje: {hoje.isoformat()}. Janela analisada: próximas 2 semanas ({janela_txt[0]} a {janela_txt[-1]})."]
    linhas.append(f"Total de itens: {len(itens)} ({len(abertos)} abertos, {len(itens) - len(abertos)} concluídos).")

    linhas.append("\nPESSOAS (utilização = horas de Task/Bug abertas ÷ capacidade nas próximas 2 semanas):")
    for pid, p in pessoas.items():
        capacidade = sum(
            0 if (d in feriados or _ausente(pid, d, ausencias)) else HORAS_POR_DIA * p.get("dedication", 1)
            for d in janela_txt
        )
        carga = 0.0
        meus = [w for w in abertos if w.get("assigneeId") == pid]
        for w in meus:
            if w.get("type") not in TIPOS_COM_HORAS or not w.get("estimateHours"):
                continue
            dias_item = [d.isoformat() for d in _dias_uteis(date.fromisoformat(w["start"]), date.fromisoformat(w["end"]))]
            if not dias_item:
                continue
            por_dia = w["estimateHours"] / len(dias_item)
            carga += por_dia * sum(1 for d in dias_item if d in janela_txt)
        util = f"{round(carga / capacidade * 100)}%" if capacidade else "sem capacidade (ausente)"
        folgas = [f'{a["start"]} a {a["end"]}' for a in ausencias if a["personId"] == pid and a["end"] >= hoje.isoformat()]
        linhas.append(
            f"- {p['name']} ({p.get('role', '')}): {len(meus)} itens abertos, {carga:.0f}h de carga, "
            f"{capacidade:.0f}h de capacidade, utilização {util}"
            + (f"; folgas: {', '.join(folgas[:3])}" if folgas else "")
        )

    linhas.append("\nITENS ABERTOS (id · tipo · título · responsável · estado · prioridade · horas · período):")
    for w in sorted(abertos, key=lambda x: (x.get("priority", 4), x.get("end", "")))[:40]:
        dono = pessoas.get(w.get("assigneeId"), {}).get("name") or "SEM RESPONSÁVEL"
        horas = f"{w['estimateHours']}h" if w.get("estimateHours") else "sem estimativa"
        linhas.append(
            f"- #{w['id']} · {w.get('type')} · {w.get('title')} · {dono} · {w.get('state')} · P{w.get('priority')} · {horas} · {w.get('start')} a {w.get('end')}"
        )
    if len(abertos) > 40:
        linhas.append(f"(e mais {len(abertos) - 40} itens abertos)")

    sem_dono = [w for w in abertos if not w.get("assigneeId")]
    atrasados = [w for w in abertos if w.get("end", "9999") < hoje.isoformat()]
    linhas.append(f"\nItens abertos sem responsável: {len(sem_dono)}. Itens abertos com prazo vencido: {len(atrasados)}.")
    proximos_feriados = [f"{d} ({n})" for d, n in feriados.items() if d >= hoje.isoformat()][:3]
    if proximos_feriados:
        linhas.append(f"Próximos feriados: {', '.join(proximos_feriados)}.")
    return "\n".join(linhas)


def _carregar() -> tuple[str, bool]:
    """Consulta o Azure e monta o resumo. Devolve (texto, deu_certo)."""
    try:
        from devops_client import AzureDevOpsClient
        from source_builder import montar_source

        return resumir(montar_source(AzureDevOpsClient())), True
    except Exception as exc:  # sem .env do Azure, sem internet, etc.
        print(f"Créu: não consegui carregar os dados do Azure: {exc}")
        return "DADOS DA EQUIPE INDISPONÍVEIS no momento (falha ao consultar o Azure DevOps).", False


def _atualizar(forcar: bool = False) -> tuple[str, bool]:
    with _trava:  # evita duas consultas ao Azure ao mesmo tempo
        agora = time.time()
        if not forcar and _cache["texto"] and agora - _cache["quando"] < CACHE_SEGUNDOS:
            return _cache["texto"], True  # outra thread acabou de atualizar
        texto, ok = _carregar()
        # Se falhou, marca como "quase vencido" para tentar de novo em 20s
        _cache.update(quando=agora if ok else agora - CACHE_SEGUNDOS + 20, texto=texto)
        return texto, ok


def contexto_da_equipe() -> str:
    """Resumo atual da equipe; se o Azure não responder, avisa a IA em vez de quebrar o chat."""
    texto = _cache["texto"]
    if texto and (_atualizador["ativo"] or time.time() - _cache["quando"] < CACHE_SEGUNDOS):
        # Com o atualizador ligado, usa o último resumo na hora (ele é renovado em segundo plano)
        return texto
    return _atualizar()[0]


def iniciar_atualizacao_em_segundo_plano(intervalo: int = CACHE_SEGUNDOS - 20) -> None:
    """Carrega os dados ao ligar o servidor e renova a cada ~100s, sem a pergunta esperar o Azure."""
    if _atualizador["ativo"]:
        return
    _atualizador["ativo"] = True

    def laco():
        while True:
            _, ok = _atualizar(forcar=True)
            time.sleep(intervalo if ok else 20)

    threading.Thread(target=laco, daemon=True, name="creu-dados-equipe").start()
