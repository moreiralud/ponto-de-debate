import fs from "fs";
import path from "path";

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

const memoryRooms: Record<string, RoomData> = {};

// Cores anônimas discretas para os participantes
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

export function getRoom(roomId: string = "geral"): RoomData {
  if (!memoryRooms[roomId]) {
    memoryRooms[roomId] = {
      messages: [
        {
          id: "welcome-1",
          sender: "🏛️ Mediador (Ponto de Debate)",
          text: "🔒 *Sala 100% Anônima Ativada.*\nNenhum nome é revelado. Ninguém sabe quem você é. Foquem nos argumentos e dados.\n\nQuando quiserem dados e ciência política, usem *@mediador*.",
          timestamp: Date.now() - 30000,
          type: "mediator",
        },
      ],
      lastUpdated: Date.now(),
    };
  }
  return memoryRooms[roomId];
}

export function addMessageToRoom(
  roomId: string,
  sender: string,
  text: string,
  type: "user" | "mediator" | "system" = "user"
): ChatMessage {
  const room = getRoom(roomId);
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sender,
    text,
    timestamp: Date.now(),
    type,
    avatarColor: type === "mediator" ? "#0f172a" : getAnonymousColor(sender),
  };

  room.messages.push(message);
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(room.messages.length - 100);
  }
  room.lastUpdated = Date.now();

  saveRoomsToDisk(memoryRooms);
  return message;
}

export function clearRoom(roomId: string = "geral") {
  memoryRooms[roomId] = {
    messages: [
      {
        id: `welcome-${Date.now()}`,
        sender: "🏛️ Mediador (Ponto de Debate)",
        text: "🔒 *Sala Reiniciada em Modo 100% Anônimo.*\nNenhum nome é rastreado. Foquem nos argumentos. Usem *@mediador* para checagem factual.",
        timestamp: Date.now(),
        type: "mediator",
      },
    ],
    lastUpdated: Date.now(),
  };
  saveRoomsToDisk(memoryRooms);
}
