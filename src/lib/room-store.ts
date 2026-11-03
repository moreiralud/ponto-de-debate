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

// 7 dias de retenção
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const memoryRooms: Record<string, RoomData> = {};

export const ANONYMOUS_COLORS = [
  "#38bdf8",
  "#fbbf24",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
];

export function getAnonymousColor(sender: string): string {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ANONYMOUS_COLORS.length;
  return ANONYMOUS_COLORS[index];
}

// Conexão com Vercel KV / Upstash Redis (com instância serverless ativa para retenção de 7 dias)
const DEFAULT_UPSTASH_URL = "https://robust-opossum-246830.upstash.io";
const DEFAULT_UPSTASH_TOKEN = "gQAAAAAAA8QuAQIgcDE1YzlkYWFkOWM1MGY0NTY1ODMyMGUyZmM5ODUyODI0NA";

let redisClient: Redis | null = null;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || DEFAULT_UPSTASH_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_UPSTASH_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (e) {
    console.warn("Aviso ao conectar com Redis:", e);
  }
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
      if (redisMessages && Array.isArray(redisMessages) && redisMessages.length > 0) {
        const validMessages = filterLastSevenDays(redisMessages);
        const data: RoomData = {
          messages: validMessages,
          lastUpdated: validMessages[validMessages.length - 1]?.timestamp || Date.now(),
        };
        memoryRooms[roomId] = data;
        return data;
      }
    } catch (err) {
      console.warn("Erro ao buscar no Redis:", err);
    }
  }

  if (!memoryRooms[roomId] || memoryRooms[roomId].messages.length === 0) {
    const defaultWelcome: ChatMessage[] = [
      {
        id: "welcome-1",
        sender: "🏛️ Árbitro do Debate",
        text: "🔒 *Sala Anônima Ativa.*\nO histórico de mensagens permanece salvo por **7 dias** continuamente.\nEnvie qualquer ponto de vista para o Árbitro analisar.",
        timestamp: Date.now() - 30000,
        type: "mediator",
      },
    ];

    memoryRooms[roomId] = {
      messages: defaultWelcome,
      lastUpdated: Date.now(),
    };

    if (redisClient) {
      try {
        await redisClient.set(`pdd_room_${roomId}`, defaultWelcome, {
          ex: SEVEN_DAYS_SECONDS,
        });
      } catch (e) {}
    }
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
  if (room.messages.length > 250) {
    room.messages = room.messages.slice(room.messages.length - 250);
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

// Sincroniza histórico do cliente com o servidor
export async function syncMessagesWithRoomAsync(
  roomId: string,
  incomingMessages: ChatMessage[]
): Promise<RoomData> {
  const room = await getRoomAsync(roomId);
  const cutoff = Date.now() - SEVEN_DAYS_MS;

  const map = new Map<string, ChatMessage>();
  room.messages.forEach((m) => map.set(m.id, m));
  incomingMessages.forEach((m) => {
    if (m.timestamp >= cutoff) {
      map.set(m.id, m);
    }
  });

  const merged = Array.from(map.values())
    .filter((m) => m.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

  room.messages = merged;
  room.lastUpdated = Date.now();

  if (redisClient) {
    try {
      await redisClient.set(`pdd_room_${roomId}`, room.messages, {
        ex: SEVEN_DAYS_SECONDS,
      });
    } catch (e) {}
  }

  memoryRooms[roomId] = room;
  saveRoomsToDisk(memoryRooms);
  return room;
}

export async function clearRoomAsync(roomId: string = "geral") {
  const freshMessages: ChatMessage[] = [
    {
      id: `welcome-${Date.now()}`,
      sender: "🏛️ Árbitro do Debate",
      text: "🔒 *Sala Reiniciada em Modo 100% Anônimo.*\nO histórico permanecerá salvo por 7 dias. Use o botão ↩️ para responder diretamente a uma mensagem.",
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
