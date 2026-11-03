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
  X,
  Reply,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ChatMessage, ReplyContext } from "@/lib/room-store";
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
  const [replyingTo, setReplyingTo] = useState<ReplyContext | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

    // Carrega histórico dos últimos 7 dias imediatamente do cache do aparelho
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

  // Polling contínuo em tempo real (1.5s) e sincronização resiliente
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

            // Se o histórico local possui mais mensagens que o servidor (ex: reinício frio de container), sincroniza de volta
            if (merged.length > data.allMessages.length) {
              fetch("/api/room", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomId: "geral", messages: merged }),
              }).catch(() => {});
            }

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

  // Envio de mensagem com suporte a Reply e retenção garantida
  const handleSendMessage = async (e?: React.FormEvent, explicitTrigger = false, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() && !explicitTrigger) return;

    const currentReply = replyingTo;
    setReplyingTo(null);
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
          replyTo: currentReply || undefined,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        setMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          prev.forEach((m) => map.set(m.id, m));
          if (resData.userMessage) map.set(resData.userMessage.id, resData.userMessage);
          if (resData.mediatorMessage) map.set(resData.mediatorMessage.id, resData.mediatorMessage);
          if (resData.allMessages && Array.isArray(resData.allMessages)) {
            resData.allMessages.forEach((m: ChatMessage) => map.set(m.id, m));
          }
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
      console.error("Falha ao enviar:", err);
    } finally {
      setIsSending(false);
      setIsMediatorThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleSelectReply = (msg: ChatMessage) => {
    setReplyingTo({
      id: msg.id,
      sender: msg.sender,
      text: msg.text,
    });
    inputRef.current?.focus();
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
    if (confirm("ATENÇÃO: Deseja realmente zerar todo o histórico de 7 dias para todos os participantes da sala?")) {
      await fetch("/api/room?roomId=geral", { method: "DELETE" });
      try {
        localStorage.removeItem("pdd_history_7d");
      } catch (e) {}
      setMessages([]);
      setShowInfoModal(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/room?roomId=geral&since=0`);
      if (res.ok) {
        const data = await res.json();
        if (data.allMessages && Array.isArray(data.allMessages)) {
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        scrollToBottom(true);
      }, 400);
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
                {myAnonId ? `Sua voz: ${myAnonId}` : "Identidade oculta"} &bull; Histórico de 7 dias ativo
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

            {/* Sincronizar Histórico */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-[#8696a0] hover:text-emerald-400 hover:bg-[#374248] transition"
              title="Sincronizar mensagens agora"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
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
                <strong>Blindagem de 7 Dias:</strong> Conversas anônimas salvas por uma semana. Clique na seta <strong>↩</strong> para rebater qualquer mensagem.
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
                <div key={msg.id} className="flex justify-center my-3 w-full group">
                  <div className="w-full max-w-xl bg-[#1e293b] border-2 border-amber-500/50 rounded-2xl shadow-xl overflow-hidden animate-fadeIn relative">
                    
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

                      <div className="flex items-center gap-1.5">
                        {/* Botão Responder ao Árbitro */}
                        <button
                          onClick={() => handleSelectReply(msg)}
                          className="px-2 py-1 rounded text-[11px] font-medium text-stone-300 hover:text-white hover:bg-stone-800 flex items-center gap-1 transition"
                          title="Rebater ou comentar a análise do Árbitro"
                        >
                          <Reply className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">Rebater</span>
                        </button>

                        {/* Copiar WhatsApp */}
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
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3.5 sm:p-4 text-xs sm:text-sm text-[#e2e8f0] font-sans selection:bg-amber-500/30">
                      <FormattedText text={msg.text} isMediator={true} />
                    </div>

                    {/* Footer */}
                    <div className="px-3.5 py-1.5 bg-[#0f172a] text-[10px] text-stone-400 flex justify-between items-center">
                      <span>Critério: Rigor de Ciência Política & Fontes Oficiais</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // Normal User Message
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} my-1.5 group`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm relative ${
                    isMe
                      ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
                      : "bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]"
                  }`}
                >
                  {/* Sender Header + Reply Button */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className="font-semibold text-xs flex items-center gap-1"
                      style={{ color: isMe ? "#6ee7b7" : msg.avatarColor || "#38bdf8" }}
                    >
                      {isMe ? "Você (Anônimo)" : msg.sender}
                    </span>

                    {/* Botão Responder */}
                    <button
                      onClick={() => handleSelectReply(msg)}
                      className="opacity-70 group-hover:opacity-100 hover:text-emerald-400 p-0.5 rounded transition"
                      title="Responder a esta mensagem"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quoted Message Preview (se for um reply) */}
                  {msg.replyTo && (
                    <div className="bg-black/30 border-l-2 border-emerald-400 rounded p-1.5 mb-1.5 text-[11px] leading-tight">
                      <div className="font-semibold text-emerald-300 truncate">
                        {msg.replyTo.sender}
                      </div>
                      <div className="text-stone-300 line-clamp-1 truncate opacity-90">
                        {msg.replyTo.text}
                      </div>
                    </div>
                  )}

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

        {/* Reply Preview Bar (Acima do campo de digitação) */}
        {replyingTo && (
          <div className="bg-[#182229] border-t border-l-4 border-emerald-500 px-3 py-2 flex items-center justify-between text-xs text-[#8696a0] animate-fadeIn z-10">
            <div className="truncate mr-2">
              <span className="font-semibold text-emerald-400 block text-[11px] flex items-center gap-1">
                <Reply className="w-3 h-3" />
                Respondendo a {replyingTo.sender}
              </span>
              <span className="text-[#d1d7db] truncate block text-[11px]">
                {replyingTo.text}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:text-white rounded-full hover:bg-[#2a3942] transition"
              title="Cancelar resposta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
              placeholder={
                replyingTo
                  ? `Respondendo a ${replyingTo.sender}...`
                  : "Digite anonimamente (ou use '@mediador')..."
              }
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
                  Regras do Ponto de Debate
                </h3>
                <button onClick={() => setShowInfoModal(false)} className="text-[#8696a0] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ul className="text-xs text-[#8696a0] space-y-2.5 leading-relaxed">
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">1. Anonimato & Histórico de 7 Dias:</strong> As mensagens são 100% anônimas e ficam salvas durante a semana para dar continuidade ao debate.
                </li>
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">2. Função Responder (Reply):</strong> Clique no ícone de seta (↩) em qualquer mensagem para rebater diretamente aquele ponto específico.
                </li>
                <li className="bg-[#111b21] p-2.5 rounded-lg border border-[#2a3942]">
                  <strong className="text-[#e9edef]">3. Análise em Tempo Real:</strong> O Árbitro analisa cada afirmação ou tréplica com dados oficiais (Câmara, ALESP, IBGE, Inep).
                </li>
              </ul>

              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-[#00a884] hover:bg-[#02906f] text-white py-2 rounded-xl text-xs font-semibold transition"
              >
                Entendi, voltar ao debate
              </button>

              <div className="pt-2 border-t border-[#2a3942]/60">
                <button
                  onClick={handleClearRoom}
                  className="w-full text-[11px] text-red-400/80 hover:text-red-300 hover:bg-red-950/30 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Zerar histórico de 7 dias (Para todos)
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
