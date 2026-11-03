"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scale,
  Send,
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  CheckCheck,
  Lock,
  HelpCircle,
  X,
} from "lucide-react";
import { ChatMessage } from "@/lib/room-store";
import { FormattedText } from "@/lib/formatter";

const ANONYMOUS_PRESETS = [
  {
    label: "🔥 Simulação: MBL vs. PT",
    messages: [
      { sender: "Participante #A", text: "O PT aparelhou o Estado por 16 anos e quer quebrar as contas públicas. Não voto em Lula nem amarrado." },
      { sender: "Participante #B", text: "E você prefere votar em moleque do MBL que debocha de mulher e é contra cotas raciais? Quem não enxerga a desigualdade do Brasil vive em outra realidade." },
    ],
  },
  {
    label: "⚖️ Simulação: Cotas Raciais",
    messages: [
      { sender: "Participante #C", text: "Cota deveria ser puramente por renda. Cota racial cria racismo de Estado e prejudica quem estudou." },
      { sender: "Participante #D", text: "Isso ignora a história. A desigualdade racial no Brasil é estrutural e não apenas de renda. Ser contra cotas é defender privilégio." },
    ],
  },
];

export default function AnonymousWhatsAppChat() {
  const [myAnonId, setMyAnonId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isMediatorThinking, setIsMediatorThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inicializa a identidade 100% anônima e restaura o histórico de 7 dias
  useEffect(() => {
    let savedId = sessionStorage.getItem("pdd_anon_id");
    if (!savedId) {
      const num = Math.floor(Math.random() * 90 + 10);
      savedId = `Participante #${num}`;
      sessionStorage.setItem("pdd_anon_id", savedId);
    }
    setMyAnonId(savedId);

    // Carrega histórico persistente dos últimos 7 dias imediatamente do cache do aparelho
    try {
      const cached = localStorage.getItem("pdd_history_7d");
      if (cached) {
        const parsed: ChatMessage[] = JSON.parse(cached);
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter((m) => m.timestamp >= cutoff);
        if (valid.length > 0) {
          setMessages(valid);
        }
      }
    } catch (e) {}
  }, []);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  // Polling contínuo em tempo real (1.5s)
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/room?roomId=geral&since=0`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.allMessages && Array.isArray(data.allMessages)) {
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          setMessages((prev) => {
            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
            data.allMessages.forEach((m: ChatMessage) => map.set(m.id, m));
            const merged = Array.from(map.values())
              .filter((m) => m.timestamp >= cutoff)
              .sort((a, b) => a.timestamp - b.timestamp);

            try {
              localStorage.setItem("pdd_history_7d", JSON.stringify(merged));
            } catch (e) {}

            return merged;
          });
        }
      } catch (err) {
        console.error("Erro no polling:", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, isMediatorThinking]);

  // Envio de mensagem anônima
  const handleSendMessage = async (e?: React.FormEvent, explicitTrigger = false, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() && !explicitTrigger) return;

    setInputText("");
    setIsSending(true);
    setIsMediatorThinking(true);

    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: "geral",
          sender: myAnonId || "Participante Anônimo",
          text: textToSend.trim(),
          triggerMediation: explicitTrigger,
        }),
      });

      if (res.ok) {
        const updatedRes = await fetch(`/api/room?roomId=geral&since=0`);
        const updatedData = await updatedRes.json();
        if (updatedData.allMessages) {
          setMessages(updatedData.allMessages);
        }
      }
    } catch (err) {
      console.error("Falha ao enviar:", err);
    } finally {
      setIsSending(false);
      setIsMediatorThinking(false);
      inputRef.current?.focus();
    }
  };

  // Carregar preset anônimo
  const handleLoadPreset = async (preset: (typeof ANONYMOUS_PRESETS)[0]) => {
    for (const msg of preset.messages) {
      await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: "geral",
          sender: msg.sender,
          text: msg.text,
        }),
      });
    }
    handleSendMessage(undefined, true, "");
  };

  const handleClearRoom = async () => {
    if (confirm("Reiniciar o debate da sala? Todas as mensagens serão limpas.")) {
      await fetch("/api/room?roomId=geral", { method: "DELETE" });
      try {
        localStorage.removeItem("pdd_history_7d");
      } catch (e) {}
      setMessages([]);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="flex justify-center bg-[#111b21] min-h-screen text-[#e9edef] font-sans">
      <div className="w-full max-w-2xl bg-[#0b141a] flex flex-col h-screen shadow-2xl relative border-x border-[#222e35]">
        
        {/* WhatsApp Top Header */}
        <header className="bg-[#202c33] px-3 sm:px-4 py-2.5 flex items-center justify-between z-10 border-b border-[#222e35]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1e293b] border border-amber-500/40 flex items-center justify-center shrink-0 shadow">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div className="cursor-pointer" onClick={() => setShowInfoModal(true)}>
              <h1 className="font-semibold text-sm sm:text-base text-[#e9edef] flex items-center gap-1.5 leading-tight">
                Ponto de Debate
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> 100% Anônimo
                </span>
              </h1>
              <p className="text-[11px] text-[#8696a0]">
                {myAnonId ? `Sua voz: ${myAnonId}` : "Identidade oculta"} &bull; Toque para regras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chamar Mediador */}
            <button
              onClick={() => handleSendMessage(undefined, true, "")}
              disabled={isMediatorThinking}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition ${
                isMediatorThinking
                  ? "bg-amber-600/40 text-amber-200 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
              }`}
              title="Acionar mediação epistemológica imediata"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Chamar Mediador</span>
            </button>

            {/* Clear Chat */}
            <button
              onClick={handleClearRoom}
              className="p-1.5 rounded-lg text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] transition"
              title="Limpar sala"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* WhatsApp Background Chat Area */}
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 relative"
          style={{
            backgroundColor: "#0b141a",
            backgroundImage: `radial-gradient(#182229 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        >
          {/* Strict Anonymity Banner */}
          <div className="flex justify-center my-1">
            <div className="bg-[#182229] border border-[#222e35] text-[#8696a0] text-[11px] px-3 py-1.5 rounded-lg max-w-md text-center shadow-sm flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                <strong>Blindagem de Anonimato:</strong> Ninguém sabe quem é você. Debatam as ideias livremente sem julgamentos pessoais.
              </span>
            </div>
          </div>

          {/* Preset Buttons (if room is empty or clean) */}
          {messages.length <= 2 && (
            <div className="bg-[#111b21]/90 border border-stone-700/50 rounded-xl p-3 text-xs text-stone-300 space-y-2 my-2">
              <div className="font-semibold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Simulações rápidas para testar com 1 clique:
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {ANONYMOUS_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleLoadPreset(p)}
                    className="bg-[#202c33] hover:bg-[#2a3942] text-stone-200 border border-[#374248] px-2.5 py-1 rounded-md text-[11px] transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const isMe = msg.sender === myAnonId;
            const isMediator = msg.type === "mediator";

            if (isMediator) {
              return (
                <div key={msg.id} className="flex justify-center my-3 w-full">
                  <div className="w-full max-w-xl bg-[#1e293b] border-2 border-amber-500/50 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
                    {/* Header */}
                    <div className="bg-stone-900 px-3.5 py-2.5 flex items-center justify-between border-b border-stone-800">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Scale className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-serif font-bold text-xs sm:text-sm text-amber-300 tracking-wide">
                          {msg.sender}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition ${
                          copiedId === msg.id
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                        }`}
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar p/ WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Content (Ultra-Direto) */}
                    <div className="p-3.5 sm:p-4 text-xs sm:text-sm text-[#e2e8f0] font-sans selection:bg-amber-500/30">
                      <FormattedText text={msg.text} isMediator={true} />
                    </div>

                    {/* Footer */}
                    <div className="px-3.5 py-1.5 bg-[#0f172a] text-[10px] text-stone-400 flex justify-between items-center">
                      <span>Critério: Rigor de Ciência Política & Fatos Oficiais</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // Normal User Message (100% Anonymous)
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} my-1.5`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm relative ${
                    isMe
                      ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
                      : "bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]"
                  }`}
                >
                  {/* Sender Header */}
                  <div
                    className="font-semibold text-xs mb-1 flex items-center gap-1"
                    style={{ color: isMe ? "#6ee7b7" : msg.avatarColor || "#38bdf8" }}
                  >
                    <span>{isMe ? "Você (Anônimo)" : msg.sender}</span>
                  </div>

                  {/* Message Body */}
                  <div className="break-words text-xs sm:text-sm">
                    <FormattedText text={msg.text} isMediator={false} />
                  </div>

                  {/* Time + Check */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0]">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking Indicator */}
          {isMediatorThinking && (
            <div className="flex justify-center my-3">
              <div className="bg-[#1e293b] border border-amber-500/40 text-amber-300 text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2.5 animate-pulse">
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span>🏛️ Árbitro checando os fatos em linguagem simples...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="bg-[#202c33] p-2 sm:p-2.5 border-t border-[#222e35]">
          <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2">
            
            {/* Tag @mediador shortcut */}
            <button
              type="button"
              onClick={() => {
                setInputText((prev) => (prev ? `${prev} @mediador` : "@mediador analisa "));
                inputRef.current?.focus();
              }}
              className="p-2 text-[#8696a0] hover:text-amber-400 hover:bg-[#2a3942] rounded-full transition"
              title="Inserir comando @mediador"
            >
              <Scale className="w-5 h-5 text-amber-400" />
            </button>

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite anonimamente (ou use '@mediador')..."
              className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
            />

            {/* Send */}
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className={`p-2.5 rounded-full text-white transition flex items-center justify-center shrink-0 ${
                inputText.trim() && !isSending
                  ? "bg-[#00a884] hover:bg-[#02906f] shadow-md"
                  : "bg-[#2a3942] text-[#8696a0] cursor-not-allowed"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Methodology / Rules Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a3942] pb-3">
                <h3 className="font-serif font-bold text-base text-[#e9edef] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Protocolo de Anonimato & Ciência Política
                </h3>
                <button onClick={() => setShowInfoModal(false)} className="text-[#8696a0] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ul className="text-xs text-[#8696a0] space-y-2.5 leading-relaxed">
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">1. Anonimato Radical:</strong> Ninguém sabe quem você é. Nenhum dado pessoal, IP ou cookies são gravados. Isso elimina o preconceito e o ataque à pessoa.
                </li>
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">2. O Mediador Julga as Ideias, Não as Pessoas:</strong> O mediador analisa as premissas e os fatos, nunca acusando indivíduos.
                </li>
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">3. Sem Falsa Equivalência:</strong> Erros factuais são apontados com fontes (IBGE, Ipea, Legislação).
                </li>
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">4. Como Chamar:</strong> Digite <code>@mediador</code> ou clique no botão dourado no topo.
                </li>
              </ul>

              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-[#00a884] hover:bg-[#02906f] text-white py-2 rounded-xl text-xs font-semibold transition"
              >
                Entendi, voltar ao debate
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
