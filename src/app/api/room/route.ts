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

        const prompt = `Analise a mensagem mais recente enviada no grupo de debate:

${replyInfo}MENSAGEM ATUAL:
"${text || 'Faça uma síntese do debate recente'}"

HISTÓRICO RECENTE:
---
${recentChat}
---

Instruções de Linguagem e Formato (Conversa entre amigos, sem jargões acadêmicos):
1. Comece respondendo diretamente à questão. Use frases curtas e palavras comuns.
2. Explique termos políticos difíceis se aparecerem.
3. Apresente no máximo 3 ou 4 argumentos principais e use exemplos concretos.
4. Diferencie fatos comprovados, interpretações e opiniões.
5. Traga 1 ou 2 fontes confiáveis com links clicáveis mascarados (ex: [Fonte: Órgão](URL)).
6. Respeite rigorosamente a estrutura de 4 partes:
   *1. O que está sendo discutido?*
   *2. O argumento tem fundamento?*
   *3. Principais pontos a considerar:*
   *4. Veredito resumido:*`;

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
