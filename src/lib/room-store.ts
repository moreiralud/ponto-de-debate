import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  type: "user" | "mediator" | "system";
  avatarColor?: string;
}

interface RoomData {
  messages: ChatMessage[];
  lastUpdated: number;
}

// 7 dias em milissegundos = 7 * 24 * 60 * 60 * 1000 = 604.800.000 ms
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

// Armazenamento em memória (fallback)
const memoryRooms: Record<string, RoomData> = {};

// Cores anônimas discretas
export const ANONYMOUS_COLORS = [
  "#38bdf8", // Azul Céu
  "#fbbf24", // Âmbar
  "#34d399", // Esmeralda
  "#a78bfa", // Roxo Claro
  "#fb7185", // Rosa
  "#2dd4bf", // Teal
];

export function getAnonymousColor(sender: string): string {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ANONYMOUS_COLORS.length;
  return ANONYMOUS_COLORS[index];
}

// Inicializa cliente Redis se as variáveis existirem (Vercel KV / Upstash)
let redisClient: Redis | null = null;
try {
  if (
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL
  ) {
    redisClient = Redis.fromEnv();
  }
} catch (e) {
  console.warn("Aviso: Redis não configurado no ambiente, operando com cache local.");
}

// Arquivo local em desenvolvimento
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "rooms.json");

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {}
}

function loadRoomsFromDisk(): Record<string, RoomData> {
  try {
    ensureDataFile();
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content || "{}");
    }
  } catch (e) {}
  return {};
}

function saveRoomsToDisk(data: Record<string, RoomData>) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

try {
  const loaded = loadRoomsFromDisk();
  Object.assign(memoryRooms, loaded);
} catch (e) {}

// Filtra para manter somente mensagens dos últimos 7 dias
function filterLastSevenDays(messages: ChatMessage[]): ChatMessage[] {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return messages.filter((m) => m.timestamp >= cutoff);
}

export async function getRoomAsync(roomId: string = "geral"): Promise<RoomData> {
  // 1. Tenta recuperar do Redis (nuvem)
  if (redisClient) {
    try {
      const redisMessages = await redisClient.get<ChatMessage[]>(`pdd_room_${roomId}`);
      if (redisMessages && Array.isArray(redisMessages)) {
        const validMessages = filterLastSevenDays(redisMessages);
        return {
          messages: validMessages,
          lastUpdated: validMessages[validMessages.length - 1]?.timestamp || Date.now(),
        };
      }
    } catch (err) {
      console.warn("Erro ao buscar no Redis:", err);
    }
  }

  // 2. Fallback para memória / disco
  if (!memoryRooms[roomId]) {
    memoryRooms[roomId] = {
      messages: [
        {
          id: "welcome-1",
          sender: "🏛️ Árbitro do Debate",
          text: "🔒 *Sala Anônima Ativa.*\nO histórico de mensagens é mantido automaticamente por **7 dias**.\nEnvie qualquer ponto de vista ou acusação para o Árbitro analisar.",
          timestamp: Date.now() - 30000,
          type: "mediator",
        },
      ],
      lastUpdated: Date.now(),
    };
  }

  // Filtra 7 dias na memória
  memoryRooms[roomId].messages = filterLastSevenDays(memoryRooms[roomId].messages);
  return memoryRooms[roomId];
}

export async function addMessageToRoomAsync(
  roomId: string,
  sender: string,
  text: string,
  type: "user" | "mediator" | "system" = "user"
): Promise<ChatMessage> {
  const room = await getRoomAsync(roomId);
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sender,
    text,
    timestamp: Date.now(),
    type,
    avatarColor: type === "mediator" ? "#0f172a" : getAnonymousColor(sender),
  };

  room.messages.push(message);
  // Mantém apenas os últimos 7 dias (máximo 200 mensagens)
  room.messages = filterLastSevenDays(room.messages);
  if (room.messages.length > 200) {
    room.messages = room.messages.slice(room.messages.length - 200);
  }
  room.lastUpdated = Date.now();

  // 1. Salva no Redis se disponível (com TTL de 7 dias)
  if (redisClient) {
    try {
      await redisClient.set(`pdd_room_${roomId}`, room.messages, {
        ex: SEVEN_DAYS_SECONDS,
      });
    } catch (err) {
      console.warn("Erro ao salvar no Redis:", err);
    }
  }

  // 2. Salva localmente
  memoryRooms[roomId] = room;
  saveRoomsToDisk(memoryRooms);

  return message;
}

export async function clearRoomAsync(roomId: string = "geral") {
  const freshMessages: ChatMessage[] = [
    {
      id: `welcome-${Date.now()}`,
      sender: "🏛️ Árbitro do Debate",
      text: "🔒 *Sala Reiniciada em Modo 100% Anônimo.*\nO histórico permanecerá salvo por 7 dias. Foquem nos argumentos e fatos.",
      timestamp: Date.now(),
      type: "mediator",
    },
  ];

  if (redisClient) {
    try {
      await redisClient.set(`pdd_room_${roomId}`, freshMessages, {
        ex: SEVEN_DAYS_SECONDS,
      });
    } catch (err) {}
  }

  memoryRooms[roomId] = {
    messages: freshMessages,
    lastUpdated: Date.now(),
  };
  saveRoomsToDisk(memoryRooms);
}
