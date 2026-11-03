import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

export interface ReplyContext {
  id: string;
  sender: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  type: "user" | "mediator" | "system";
  avatarColor?: string;
  replyTo?: ReplyContext;
}

interface RoomData {
  messages: ChatMessage[];
  lastUpdated: number;
}

// 7 dias em milissegundos
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const memoryRooms: Record<string, RoomData> = {};

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

function filterLastSevenDays(messages: ChatMessage[]): ChatMessage[] {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return messages.filter((m) => m.timestamp >= cutoff);
}

export async function getRoomAsync(roomId: string = "geral"): Promise<RoomData> {
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

  if (!memoryRooms[roomId]) {
    memoryRooms[roomId] = {
      messages: [
        {
          id: "welcome-1",
          sender: "🏛️ Árbitro do Debate",
          text: "🔒 *Sala Anônima Ativa.*\nO histórico é salvo por **7 dias**. Para rebater ou responder a alguém, clique no botão de resposta (↩️) na mensagem.",
          timestamp: Date.now() - 30000,
          type: "mediator",
        },
      ],
      lastUpdated: Date.now(),
    };
  }

  memoryRooms[roomId].messages = filterLastSevenDays(memoryRooms[roomId].messages);
  return memoryRooms[roomId];
}

export async function addMessageToRoomAsync(
  roomId: string,
  sender: string,
  text: string,
  type: "user" | "mediator" | "system" = "user",
  replyTo?: ReplyContext
): Promise<ChatMessage> {
  const room = await getRoomAsync(roomId);
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sender,
    text,
    timestamp: Date.now(),
    type,
    avatarColor: type === "mediator" ? "#0f172a" : getAnonymousColor(sender),
    replyTo: replyTo || undefined,
  };

  room.messages.push(message);
  room.messages = filterLastSevenDays(room.messages);
  if (room.messages.length > 200) {
    room.messages = room.messages.slice(room.messages.length - 200);
  }
  room.lastUpdated = Date.now();

  if (redisClient) {
    try {
      await redisClient.set(`pdd_room_${roomId}`, room.messages, {
        ex: SEVEN_DAYS_SECONDS,
      });
    } catch (err) {
      console.warn("Erro ao salvar no Redis:", err);
    }
  }

  memoryRooms[roomId] = room;
  saveRoomsToDisk(memoryRooms);

  return message;
}

export async function clearRoomAsync(roomId: string = "geral") {
  const freshMessages: ChatMessage[] = [
    {
      id: `welcome-${Date.now()}`,
      sender: "🏛️ Árbitro do Debate",
      text: "🔒 *Sala Reiniciada em Modo 100% Anônimo.*\nHistórico salvo por 7 dias. Use o botão ↩️ para responder diretamente a uma mensagem.",
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
