import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Minus, Send } from 'lucide-react';
import { getAccessToken } from '@/integrations/supabase';

const CHATBOT_URL: string = (import.meta.env as Record<string, any>)['VITE_CHATBOT_URL'] || '/api/chatbot';
/** Mesmo limite do backend (app.py → MAX_MENSAGEM). */
const MAX_MENSAGEM = 500;
/** Depois disso sem resposta, desiste e libera o chat. */
const TEMPO_LIMITE_MS = 60_000;

interface Mensagem {
  texto: string;
  isUser: boolean;
  /** Mensagem de erro do sistema: não vai no histórico enviado à IA. */
  erro?: boolean;
}

/** Mostra **negrito** e quebras de linha que a IA costuma usar. */
function TextoFormatado({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {partes.map((parte, i) =>
        parte.startsWith('**') && parte.endsWith('**') && parte.length > 4
          ? <strong key={i}>{parte.slice(2, -2)}</strong>
          : <React.Fragment key={i}>{parte}</React.Fragment>,
      )}
    </>
  );
}

/** Três pontinhos pulando: "Créu está digitando". */
function Digitando() {
  return (
    <div className="self-start rounded-lg rounded-bl-none border border-gray-200 bg-white px-3 py-2.5 shadow-sm" role="status" aria-label="Créu está digitando">
      <span className="block text-[10px] opacity-75 mb-1 text-gray-800">Créu</span>
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 150, 300].map((atraso) => (
          <span key={atraso} className="h-2 w-2 rounded-full bg-[#0056b3]/70 animate-bounce" style={{ animationDelay: `${atraso}ms` }} />
        ))}
      </span>
    </div>
  );
}

export default function CreuChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { texto: "Olá! Sou o Créu. Como posso ajudar a analisar a capacidade da sua equipe no Azure DevOps hoje?", isUser: false }
  ]);
  const [inputUsuario, setInputUsuario] = useState("");
  /** true do envio até a resposta terminar: bloqueia novas mensagens. */
  const [carregando, setCarregando] = useState(false);
  /** true depois que o primeiro pedaço da resposta chegou (troca os pontinhos pelo texto). */
  const [escrevendo, setEscrevendo] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, isOpen, carregando]);

  // Devolve o foco ao campo quando o Créu termina de responder
  useEffect(() => {
    if (isOpen && !carregando) inputRef.current?.focus();
  }, [isOpen, carregando]);

  const texto = inputUsuario.trim();
  const longoDemais = texto.length > MAX_MENSAGEM;
  const podeEnviar = !carregando && texto.length > 0 && !longoDemais;

  /** Atualiza o texto da última mensagem (a resposta que está sendo escrita). */
  const atualizarUltima = (novoTexto: string, erro = false) =>
    setMensagens(prev => [...prev.slice(0, -1), { texto: novoTexto, isUser: false, erro }]);

  const enviarMensagem = async () => {
    if (!podeEnviar) return;

    const novaMensagem = texto;
    // Últimas mensagens vão junto para o Créu entender perguntas de continuação ("e ela?")
    const historico = mensagens.filter(m => !m.erro).slice(-8).map(({ texto, isUser }) => ({ texto, isUser }));
    setMensagens(prev => [...prev, { texto: novaMensagem, isUser: true }]);
    setInputUsuario("");
    setCarregando(true);
    setEscrevendo(false);

    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
    let recebido = "";

    try {
      // Por padrão usa o proxy do Vite (/api/chatbot -> Flask na porta 5001).
      // Para apontar para outro servidor, defina VITE_CHATBOT_URL no .env do front.
      const response = await fetch(CHATBOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await getAccessToken()) ?? ''}` },
        body: JSON.stringify({ mensagem: novaMensagem, historico, stream: true }),
        signal: controle.signal,
      });

      // Versão antiga do backend (sem streaming) responde em JSON
      if ((response.headers.get('content-type') ?? '').includes('application/json')) {
        let data: { resposta?: string; erro?: string } = {};
        try { data = await response.json(); } catch { /* sem JSON válido */ }
        const resposta = data.resposta || data.erro || `Erro do servidor (HTTP ${response.status}).`;
        setMensagens(prev => [...prev, { texto: resposta, isUser: false, erro: !response.ok }]);
        return;
      }

      if (!response.ok || !response.body) {
        const erroTexto = (await response.text().catch(() => '')).trim();
        setMensagens(prev => [...prev, { texto: erroTexto || `Erro do servidor (HTTP ${response.status}).`, isUser: false, erro: true }]);
        return;
      }

      // Streaming: o texto vai aparecendo enquanto o Créu escreve
      const leitor = response.body.getReader();
      const decodificador = new TextDecoder();
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        const pedaco = decodificador.decode(value, { stream: true });
        if (!pedaco) continue;
        if (!recebido) {
          setEscrevendo(true);
          recebido = pedaco;
          setMensagens(prev => [...prev, { texto: recebido, isUser: false }]);
        } else {
          recebido += pedaco;
          atualizarUltima(recebido);
        }
      }
      recebido += decodificador.decode();
      if (recebido) atualizarUltima(recebido);
      else setMensagens(prev => [...prev, { texto: "Não consegui gerar uma resposta agora. Tente reformular a pergunta.", isUser: false, erro: true }]);
    } catch (error) {
      const expirou = controle.signal.aborted;
      const aviso = expirou
        ? "O Créu demorou demais para responder. Tente de novo em alguns segundos."
        : "Erro: não foi possível conectar ao servidor Python. Verifique se o app.py está rodando (porta 5001).";
      if (recebido) atualizarUltima(`${recebido}\n\n(${aviso})`, true);
      else setMensagens(prev => [...prev, { texto: aviso, isUser: false, erro: true }]);
    } finally {
      clearTimeout(limite);
      setCarregando(false);
      setEscrevendo(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-6 z-50 flex flex-col items-end font-sans">
      {/* Janela de Chat no estilo "Barrinha do Facebook" */}
      {isOpen && (
        <div className="w-80 sm:w-85 overflow-hidden rounded-t-lg border border-b-0 border-gray-300 bg-white shadow-2xl">
          {/* Cabeçalho da Barrinha */}
          <div className="flex items-center justify-between bg-[#0056b3] px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full inline-block ${carregando ? 'bg-amber-300 animate-pulse' : 'bg-green-400'}`}></span>
              <div className="leading-tight">
                <span className="block font-semibold text-sm">Créu - Assistente iCrew</span>
                <span className="block text-[10px] text-white/80" aria-live="polite">
                  {carregando ? (escrevendo ? 'escrevendo…' : 'pensando…') : 'online'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-blue-700 rounded transition-colors" title="Minimizar">
                <Minus size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-blue-700 rounded transition-colors" title="Fechar">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Corpo das Mensagens */}
          <div className="h-72 overflow-y-auto p-3 flex flex-col gap-2.5 bg-gray-50 text-sm" aria-live="polite">
            {mensagens.map((msg, index) => {
              const ultimaEscrevendo = escrevendo && index === mensagens.length - 1 && !msg.isUser;
              return (
                <div
                  key={index}
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg p-2.5 leading-relaxed ${
                    msg.isUser
                      ? 'self-end bg-[#0056b3] text-white rounded-br-none'
                      : msg.erro
                        ? 'self-start bg-red-50 text-red-800 border border-red-200 rounded-bl-none'
                        : 'self-start bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  <span className="block text-[10px] opacity-75 mb-0.5">{msg.isUser ? 'Eu' : 'Créu'}</span>
                  <TextoFormatado texto={msg.texto} />
                  {ultimaEscrevendo && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-gray-500" aria-hidden />}
                </div>
              );
            })}
            {carregando && !escrevendo && <Digitando />}
            <div ref={chatEndRef} />
          </div>

          {/* Caixa de Texto (Footer) */}
          <div className="border-t border-gray-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputUsuario}
                onChange={(e) => setInputUsuario(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void enviarMensagem(); } }}
                disabled={carregando}
                maxLength={MAX_MENSAGEM + 50}
                aria-invalid={longoDemais}
                placeholder={carregando ? "Aguarde o Créu responder…" : "Escreva uma mensagem..."}
                className={`flex-1 rounded-full border bg-gray-50 px-3.5 py-1.5 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                  longoDemais ? 'border-red-400 focus-visible:ring-red-400' : 'border-gray-300 focus-visible:ring-[#0056b3]'
                }`}
              />
              <button
                onClick={() => void enviarMensagem()}
                disabled={!podeEnviar}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0056b3] text-white shadow transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
                title={carregando ? "Aguarde a resposta" : "Enviar"}
              >
                <Send size={14} />
              </button>
            </div>
            {texto.length > MAX_MENSAGEM - 100 && (
              <p className={`mt-1 px-2 text-right text-[10px] ${longoDemais ? 'text-red-600' : 'text-gray-500'}`}>
                {longoDemais
                  ? `Mensagem longa demais: ${texto.length}/${MAX_MENSAGEM} caracteres. Tente resumir.`
                  : `${texto.length}/${MAX_MENSAGEM}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Botão de Abrir Estilo "Barra de Mensagens" */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-t-lg bg-[#0056b3] px-4 py-2.5 text-white shadow-lg transition-all hover:bg-blue-700 focus:outline-none"
        >
          <MessageCircle size={18} />
          <span className="font-medium text-sm">Chat - Créu (iCrew)</span>
        </button>
      )}
    </div>
  );
}
