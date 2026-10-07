import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Coloca aqui a tua chave real da OpenAI para teste
api_key = os.getenv("AI_API_KEY") or "sk-proj-a_tua_chave_real_aqui"
client = OpenAI(api_key=api_key)

def explicar_alerta(tipo_problema, descricao):
    """Função que chama a OpenAI para explicar o alerta do DevOps"""
    try:
        resposta = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "És um mentor de agilidade e gestão de projetos."},
                {"role": "user", "content": f"Explica este problema de processo ágil e dá uma sugestão de melhoria: {descricao}"}
            ]
        )
        return resposta.choices[0].message.content
    except Exception as e:
        return f"Não foi possível gerar a explicação da IA no momento: {str(e)}"