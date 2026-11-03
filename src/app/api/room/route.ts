import { NextRequest, NextResponse } from "next/server";
import { getRoom, addMessageToRoom, clearRoom, ChatMessage } from "@/lib/room-store";
import { generateMediation } from "@/lib/gemini";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId") || "geral";
  const since = Number(searchParams.get("since") || 0);

  const room = getRoom(roomId);

  const newMessages = since > 0
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

    if (!text && !triggerExplicit) {
      return NextResponse.json(
        { error: "Mensagem não pode ser vazia." },
        { status: 400 }
      );
    }

    let userMessage: ChatMessage | null = null;
    if (text) {
      userMessage = addMessageToRoom(roomId, sender, text, "user");
    }

    const room = getRoom(roomId);

    // Avalia se deve analisar:
    // Analisa TODA mensagem que chegue (exceto monossílabos ou risadas)
    const isTrivial =
      text.length < 4 ||
      /^(kkk+|rsrs+|haha+|oi|olá|ola|blz|ok|beleza|sim|não|nao|valeu)$/i.test(text.trim());

    const shouldMediate = triggerExplicit || (!isTrivial && text.length >= 4);

    let mediatorMessage: ChatMessage | null = null;

    if (shouldMediate) {
      try {
        const recentChat = room.messages
          .slice(-8)
          .map((m) => `${m.sender}: ${m.text}`)
          .join("\n\n");

        const prompt = `Analise a mensagem mais recente enviada no chat:

MENSAGEM:
"${text || 'Faça uma síntese do debate recente'}"

HISTÓRICO RECENTE:
---
${recentChat}
---

Instruções fundamentais:
- ENFRENTE A ACUSAÇÃO DIRETAMENTE: Se a mensagem diz "o MBL é misógino", "o PT é comunista" ou qualquer outra acusação, DIGA SE A ACUSAÇÃO TEM SUSTENTAÇÃO, NÃO TEM OU SE HÁ INCLINAÇÃO NA PRÁTICA.
- DADOS CONCRETOS OBRIGATÓRIOS: Traga os escândalos reais, votações na Câmara/Assembleias, cassações (como o caso Arthur do Val na ALESP), decisões do STF ou dados do IBGE/Inep.
- LINKS COM MÁSCARA CLICÁVEL: Ex: [Fonte: ALESP](https://www.alesp.sp.gov.br), [Fonte: Câmara](https://www.camara.leg.br), [Fonte: Inep/MEC](https://www.gov.br/inep).
- Dê o veredito factual sem covardia e sem floreios acadêmicos.`;

        const mediatorText = await generateMediation(prompt);

        if (mediatorText) {
          mediatorMessage = addMessageToRoom(
            roomId,
            "🏛️ Árbitro do Debate",
            mediatorText,
            "mediator"
          );
        }
      } catch (aiError: any) {
        console.error("Erro no árbitro de mensagem:", aiError);
      }
    }

    return NextResponse.json({
      success: true,
      userMessage,
      mediatorMessage,
      lastUpdated: room.lastUpdated,
    });
  } catch (error: any) {
    console.error("Erro na rota /api/room:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno no processamento da mensagem." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId") || "geral";
  clearRoom(roomId);
  return NextResponse.json({ success: true, message: "Sala reiniciada com sucesso." });
}
