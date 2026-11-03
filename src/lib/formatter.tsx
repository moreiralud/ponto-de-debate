import React from "react";

/**
 * Renderiza texto com formatação estilo WhatsApp / Markdown:
 * - *negrito* ou **negrito** -> <strong>
 * - [Texto](URL) -> <a href="URL" target="_blank">Texto ↗</a>
 * - _itálico_ -> <em>
 * - Preserva quebras de linha
 */
export function FormattedText({ text, isMediator }: { text: string; isMediator?: boolean }) {
  // Se for texto simples sem formatação
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        return (
          <div key={lineIdx} className="leading-relaxed">
            {renderLineWithLinksAndBold(line, isMediator)}
          </div>
        );
      })}
    </div>
  );
}

function renderLineWithLinksAndBold(line: string, isMediator?: boolean): React.ReactNode {
  // Regex para capturar links [Texto](URL), negritos *texto* e **texto**
  // Padrão de link markdown: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let keyCounter = 0;

  // Primeiro fazemos a tokenização linha a linha
  const tokenRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    // Texto antes do match
    if (match.index > lastIndex) {
      parts.push(line.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // É um Link mascarado [Texto](URL)
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a
          key={`link-${keyCounter++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 font-medium bg-emerald-950/40 hover:bg-emerald-900/50 px-1.5 py-0.5 rounded text-[11px] transition mx-0.5 border border-emerald-500/30"
          title={`Abrir fonte oficial: ${linkUrl}`}
        >
          <span>{linkText}</span>
          <span className="text-[10px] opacity-75">↗</span>
        </a>
      );
    } else if (match[3] || match[4]) {
      // É um Negrito **texto** ou *texto*
      const boldText = match[3] || match[4];
      parts.push(
        <strong
          key={`bold-${keyCounter++}`}
          className={`font-semibold ${isMediator ? "text-amber-200" : "text-white"}`}
        >
          {boldText}
        </strong>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // Restante do texto após o último match
  if (lastIndex < line.length) {
    parts.push(line.substring(lastIndex));
  }

  return parts.length > 0 ? parts : line;
}
