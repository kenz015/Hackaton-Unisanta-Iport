import streamlit as st
import pandas as pd
from devops_client import buscar_ids_sprint_atual, buscar_detalhes_itens, aplicar_tags_no_azure
from rules_engine import validar_processo, calcular_score_risco
from ia_service import explicar_alerta

# Configuração da página para ocupar todo o ecrã e ter um título limpo
st.set_page_config(page_title="Farol | Gestão Inteligente", page_icon="⚓", layout="wide")

# Aplicação de CSS personalizado para melhorar a estética geral
st.markdown("""
    <style>
    .main-title { font-size: 2.8rem; font-weight: 800; color: #0f172a; margin-bottom: 0; }
    .sub-title { font-size: 1.2rem; color: #64748b; margin-bottom: 2rem; }
    .stMetric { background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .alerta-box { padding: 15px; border-left: 5px solid #f59e0b; background-color: #fffbeb; border-radius: 4px; margin-bottom: 10px; }
    </style>
""", unsafe_allow_html=True)

st.markdown('<p class="main-title">⚓ Farol</p>', unsafe_allow_html=True)
st.markdown('<p class="sub-title">O seu assistente inteligente para validação de processos e gestão de riscos no Azure DevOps.</p>', unsafe_allow_html=True)

# --- BARRA LATERAL ---
with st.sidebar:
    st.header("⚙️ Painel de Controlo")
    st.info("Inicie a análise sincronizando os dados do projeto.")
    
    if st.button("🔄 Sincronizar Azure DevOps", type="primary", use_container_width=True):
        with st.spinner("A comunicar com a API..."):
            ids = buscar_ids_sprint_atual()
            itens = buscar_detalhes_itens(ids)
            st.session_state['itens'] = itens
            st.success("Sincronização concluída!")

# --- CORPO PRINCIPAL ---
if 'itens' in st.session_state and len(st.session_state['itens']) > 0:
    itens = st.session_state['itens']
    df_alertas = validar_processo(itens)
    
    # Navegação por separadores
    tab_resumo, tab_auditoria, tab_riscos, tab_tags = st.tabs([
        "📊 Visão Geral", "🛡️ Auditoria e IA", "⚠️ Matriz de Riscos", "🏷️ Aplicar Rótulos"
    ])
    
    # SEPARADOR 1: Visão Geral
    with tab_resumo:
        st.subheader("Estado Atual da Sprint")
        col1, col2, col3, col4 = st.columns(4)
        
        # Simulando cálculo real baseado nos itens recolhidos
        metricas_exemplo = {"sobrecarga": 0.8, "sem_dono": 0.4, "bugs": 0.2} 
        score, faixa = calcular_score_risco(metricas_exemplo)
        
        col1.metric(label="Score de Risco", value=f"{score:.1f}/100", delta=faixa, delta_color="inverse")
        col2.metric(label="Total de Alertas", value=len(df_alertas))
        col3.metric(label="Itens Ativos", value=len(itens))
        col4.metric(label="Progresso Estimado", value="45%")
        
        st.divider()
        st.markdown("### Resumo Rápido")
        st.write("A equipa está com uma concentração de tarefas sem responsável atribuído. O risco do projeto está atualmente elevado devido a gargalos na capacidade.")

    # SEPARADOR 2: Auditoria e IA
    with tab_auditoria:
        col_lista, col_ia = st.columns([1.2, 1])
        
        with col_lista:
            st.subheader("Anomalias Detetadas")
            if not df_alertas.empty:
                for index, row in df_alertas.iterrows():
                    st.markdown(f'<div class="alerta-box"><strong>[{row["gravidade"]}]</strong> {row["mensagem"]}</div>', unsafe_allow_html=True)
            else:
                st.success("Não foram encontrados problemas de processo nesta sprint!")
                
        with col_ia:
            st.subheader("Mentor IA 🤖")
            st.markdown("Selecione um alerta para a Inteligência Artificial explicar a teoria e propor uma solução.")
            if not df_alertas.empty:
                alerta_selecionado = st.selectbox("Selecione o problema:", df_alertas['mensagem'], label_visibility="collapsed")
                if st.button("Analisar com IA", use_container_width=True):
                    with st.spinner("A raciocinar sobre as evidências..."):
                        # Simulação da chamada (remova o texto fixo e ative a IA quando a chave estiver configurada)
                        explicacao = explicar_alerta("Desvio de processo", alerta_selecionado)
                        st.info(explicacao)

    # SEPARADOR 3: Riscos
    with tab_riscos:
        st.subheader("Mapeamento de Riscos e Mitigação")
        st.markdown("A ferramenta cruza a probabilidade com o impacto para determinar a saúde do projeto[cite: 1, 9].")
        
        df_riscos = pd.DataFrame({
            "Ameaça Detetada": ["Sobrecarga Técnica", "Dependência de Conhecimento", "Tarefas Órfãs"],
            "Probabilidade": ["Alta", "Média", "Alta"],
            "Impacto": ["Alto", "Alto", "Médio"],
            "Ação Recomendada": ["Redistribuir trabalho", "Promover documentação partilhada", "Atribuir donos na Daily Scrum"]
        })
        st.dataframe(df_riscos, use_container_width=True, hide_index=True)

    # SEPARADOR 4: Aplicar Tags
    with tab_tags:
        st.subheader("Sincronização Bidirecional")
        st.write("A IA classificou os cartões. Antes de enviar para o Azure DevOps, um humano deve rever as etiquetas (Human-in-the-loop).")
        
        with st.expander("Ver pré-visualização das alterações", expanded=True):
            st.code("Item 123 -> Rótulos a adicionar: [ia:backend, ia:risco-alto, ia:complexidade-media]")
            
        col_btn1, col_btn2 = st.columns([1, 3])
        with col_btn1:
            if st.button("Gravar no DevOps", type="primary"):
                sucesso, tags = aplicar_tags_no_azure(itens[0]["id"], ["ia:backend", "ia:risco-alto"], so_simular=True)
                if sucesso:
                    st.success("Modo simulação: Tags validadas com sucesso pela API!")

else:
    # Ecrã vazio inicial
    st.markdown("""
        <div style="text-align: center; padding: 50px;">
            <h3 style="color: #cbd5e1;">O sistema aguarda a ligação com os dados.</h3>
            <p style="color: #94a3b8;">Utilize o botão lateral para importar o cenário atual da equipa.</p>
        </div>
    """, unsafe_allow_html=True)