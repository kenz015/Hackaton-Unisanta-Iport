import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Minus, Send } from 'lucide-react';

const CHATBOT_URL: string = (import.meta.env as Record<string, any>)['VITE_CHATBOT_URL'] || '/api/chatbot';

interface Mensagem {
  texto: string;
  isUser: boolean;
}

export default function CreuChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { texto: "Olá! Sou o Créu. Como posso ajudar a analisar a capacidade da tua equipa no Azure DevOps hoje?", isUser: false }
  ]);
  const [inputUsuario, setInputUsuario] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, isOpen]);

  const enviarMensagem = async () => {
    if (!inputUsuario.trim()) return;

    const novaMensagem = inputUsuario;
    // Últimas mensagens vão junto para o Créu entender perguntas de continuação ("e ela?")
    const historico = mensagens.slice(-8);
    setMensagens(prev => [...prev, { texto: novaMensagem, isUser: true }]);
    setInputUsuario("");

    try {
      // Por padrao usa o proxy do Vite (/api/chatbot -> Flask na porta 8080).
      // Para apontar para outro servidor, defina VITE_CHATBOT_URL no .env do front.
      const response = await fetch(CHATBOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: novaMensagem, historico }),
      });

      let data: { resposta?: string; erro?: string } = {};
      try {
        data = await response.json();
      } catch {
        // resposta sem JSON valido
      }

      if (data.resposta) {
        setMensagens(prev => [...prev, { texto: data.resposta as string, isUser: false }]);
      } else {
        setMensagens(prev => [
          ...prev,
          { texto: data.erro || `Erro do servidor (HTTP ${response.status}).`, isUser: false },
        ]);
      }
    } catch (error) {
      setMensagens(prev => [
        ...prev,
        { texto: "Erro: não foi possível conectar ao servidor Python. Verifique se o app.py está rodando na porta 8080.", isUser: false },
      ]);
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
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 inline-block"></span>
              <span className="font-semibold text-sm">Créu - Assistente iCrew</span>
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
          <div className="h-72 overflow-y-auto p-3 flex flex-col gap-2.5 bg-gray-50 text-sm">
            {mensagens.map((msg, index) => (
              <div 
                key={index} 
                className={`max-w-[85%] rounded-lg p-2.5 leading-relaxed ${
                  msg.isUser 
                    ? 'self-end bg-[#0056b3] text-white rounded-br-none' 
                    : 'self-start bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
                }`}
              >
                <span className="block text-[10px] opacity-75 mb-0.5">{msg.isUser ? 'Tu' : 'Créu'}</span>
                {msg.texto}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Caixa de Texto (Footer) */}
          <div className="border-t border-gray-200 bg-white p-2 flex items-center gap-2">
            <input 
              type="text" 
              value={inputUsuario}
              onChange={(e) => setInputUsuario(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
              placeholder="Escreve uma mensagem..." 
              className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-3.5 py-1.5 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0056b3]"
            />
            <button 
              onClick={enviarMensagem} 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0056b3] text-white shadow hover:bg-blue-700 transition-colors"
              title="Enviar"
            >
              <Send size={14} />
            </button>
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