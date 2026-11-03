import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.debate || typeof body.debate !== "string") {
      return NextResponse.json(
        { error: "O campo 'debate' é obrigatório e deve conter o texto a ser mediado." },
        { status: 400 }
      );
    }

    const debate = body.debate.trim();
    if (debate.length < 10) {
      return NextResponse.json(
        { error: "O texto do debate é muito curto. Forneça mais contexto ou as duas teses em discussão." },
        { status: 400 }
      );
    }

    // Validação opcional de código de acesso para o grupo de amigos
    const expectedAccessCode = process.env.ACCESS_CODE;
    if (expectedAccessCode) {
      const providedCode = req.headers.get("x-access-code") || body.accessCode;
      if (providedCode !== expectedAccessCode) {
        return NextResponse.json(
          { error: "Código de acesso ao grupo incorreto." },
          { status: 401 }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Se não houver chave de API configurada, retornar mensagem amigável com instruções
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "A variável GEMINI_API_KEY não foi configurada no ambiente. Adicione sua chave gratuita do Google AI Studio (.env.local ou nas configurações da Vercel).",
        },
        { status: 503 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Modelo ultra-rápido com excelente capacidade analítica e cota gratuita generosa
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.2, // Baixa temperatura para manter rigor factual e estabilidade epistemológica
        topP: 0.85,
        maxOutputTokens: 2048,
      },
    });

    const userPrompt = `Analise e medie a seguinte discussão ocorrida no grupo com MÁXIMA CONCISÃO (padrão WhatsApp, máximo 150 palavras):

---
${debate}
---

Siga o formato telegráfico e direto sem enrolação.`;

    const result = await model.generateContentStream(userPrompt);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (streamError: any) {
          console.error("Erro durante o streaming da Gemini API:", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error: any) {
    console.error("Erro na rota /api/mediate:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Ocorreu um erro interno ao processar a mediação. Verifique a chave da API e tente novamente.",
      },
      { status: 500 }
    );
  }
}
