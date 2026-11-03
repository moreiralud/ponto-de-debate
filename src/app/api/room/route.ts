import { NextRequest, NextResponse } from "next/server";
import {
  getRoomAsync,
  addMessageToRoomAsync,
  clearRoomAsync,
  syncMessagesWithRoomAsync,
  ChatMessage,
  ReplyContext,
} from "@/lib/room-store";
import { generateMediation } from "@/lib/gemini";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId") || "geral";
  const since = Number(searchParams.get("since") || 0);

  const room = await getRoomAsync(roomId);

  const newMessages =
    since > 0
      ? room.messages.filter((m) => m.timestamp > since)
      : room.messages;

  return NextResponse.json({
    messages: newMessages,
    allMessages: room.messages,
    lastUpdated: room.lastUpdated,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomId = body.roomId || "geral";
    const sender = (body.sender || "Participante Anônimo").trim();
    const text = (body.text || "").trim();
    const triggerExplicit = Boolean(body.triggerMediation);
    const replyTo: ReplyContext | undefined = body.replyTo;

    if (!text && !triggerExplicit) {
      return NextResponse.json(
        { error: "Mensagem não pode ser vazia." },
        { status: 400 }
      );
    }

    let userMessage: ChatMessage | null = null;
    if (text) {
      userMessage = await addMessageToRoomAsync(roomId, sender, text, "user", replyTo);
    }

    const room = await getRoomAsync(roomId);

    const isTrivial =
      text.length < 4 ||
      /^(kkk+|rsrs+|haha+|oi|olá|ola|blz|ok|beleza|sim|não|nao|valeu)$/i.test(text.trim());

    const shouldMediate = triggerExplicit || (!isTrivial && text.length >= 4);

    let mediatorMessage: ChatMessage | null = null;

    if (shouldMediate) {
      try {
        const recentChat = room.messages
          .slice(-8)
          .map((m) => {
            const replyPrefix = m.replyTo
              ? ` [Respondendo a ${m.replyTo.sender}: "${m.replyTo.text}"]`
              : "";
            return `${m.sender}${replyPrefix}: ${m.text}`;
          })
          .join("\n\n");

        const replyInfo = replyTo
          ? `ESTA MENSAGEM É UMA RESPOSTA DIRETA A:\n[${replyTo.sender}]: "${replyTo.text}"\n\n`
          : "";

        const prompt = `Analise a mensagem mais recente enviada no chat:

${replyInfo}MENSAGEM ATUAL:
"${text || 'Faça uma síntese do debate recente'}"

HISTÓRICO RECENTE:
---
${recentChat}
---

Instruções fundamentais:
- ENFRENTE A ACUSAÇÃO/RESPOSTA DIRETAMENTE: Se a pessoa está rebatendo alguém, avalie se a tréplica tem sustentação factual ou se comete falácias.
- DADOS CONCRETOS OBRIGATÓRIOS: Traga os escândalos reais, votações na Câmara/Assembleias, cassações, decisões do STF ou dados do IBGE/Inep.
- LINKS COM MÁSCARA CLICÁVEL: Ex: [Fonte: ALESP](https://www.alesp.sp.gov.br), [Fonte: Câmara](https://www.camara.leg.br), [Fonte: Inep/MEC](https://www.gov.br/inep).
- Dê o veredito factual sem covardia e sem floreios acadêmicos.`;

        const mediatorText = await generateMediation(prompt);

        if (mediatorText) {
          mediatorMessage = await addMessageToRoomAsync(
            roomId,
            "🏛️ Árbitro do Debate",
            mediatorText,
            "mediator",
            userMessage ? { id: userMessage.id, sender: userMessage.sender, text: userMessage.text } : undefined
          );
        }
      } catch (aiError: any) {
        console.error("Erro no árbitro de mensagem:", aiError);
      }
    }

    const updatedRoom = await getRoomAsync(roomId);

    return NextResponse.json({
      success: true,
      userMessage,
      mediatorMessage,
      allMessages: updatedRoom.messages,
      lastUpdated: updatedRoom.lastUpdated,
    });
  } catch (error: any) {
    console.error("Erro na rota /api/room:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno no processamento da mensagem." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const roomId = body.roomId || "geral";
    const messages = body.messages;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Campo 'messages' deve ser um array." },
        { status: 400 }
      );
    }

    const room = await syncMessagesWithRoomAsync(roomId, messages);
    return NextResponse.json({
      success: true,
      allMessages: room.messages,
      lastUpdated: room.lastUpdated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao sincronizar mensagens." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId") || "geral";
  await clearRoomAsync(roomId);
  return NextResponse.json({ success: true, message: "Sala reiniciada com sucesso." });
}
