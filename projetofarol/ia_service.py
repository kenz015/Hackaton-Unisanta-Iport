import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("AI_API_KEY"))

def classificar_item_com_ia(tipo, titulo, descricao, criterios=""):
    prompt = f"""
    Você é um analista de processos de desenvolvimento de software[cite: 34].
    Avalie o item de trabalho abaixo usando a rubrica INVEST[cite: 34].
    Responda APENAS com JSON válido:
    {{
        "area": "<frontend|backend|banco-de-dados|infra-devops|qa-testes|seguranca|ux|documentacao|integracao>",
        "complexidade": "<baixa | media | alta>",
        "qualidade_descricao": <1 a 5>,
        "problemas": ["lista de problemas"],
        "justificativa": "uma frase"
    }}
    
    Item:
    Tipo: {tipo}
    Título: {titulo}
    Descrição: {descricao}
    Critérios de Aceite: {criterios}
    """ #[cite: 34]
    
    resposta = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.1 # Temperatura baixa na classificação
    )
    return resposta.choices[0].message.content

def explicar_alerta(regra, evidencias):
    prompt = f"""
    Você é um mentor de gestão de projetos de software, falando com estudantes[cite: 34].
    Explique o alerta abaixo em até 4 frases, em português simples.
    Estrutura: (1) o que aconteceu; (2) o conceito de gestão leigo; (3) o termo técnico; (4) uma ação recomendada[cite: 34].
    Não invente números.
    
    Alerta: {regra}
    Evidências: {evidencias}
    """ #[cite: 34]
    
    resposta = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5
    )
    return resposta.choices[0].message.content