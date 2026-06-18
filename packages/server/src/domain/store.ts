import { Room } from "./Room.js";

const rooms = new Map<string, Room>();

export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode);
}

export function createRoom(roomCode: string): Room {
  const room = new Room(roomCode);
  rooms.set(roomCode, room);
  return room;
}

export function getOrCreateRoom(roomCode: string): Room {
  return rooms.get(roomCode) ?? createRoom(roomCode);
}

export function deleteRoom(roomCode: string): void {
  rooms.delete(roomCode);
}

export function allRooms(): Room[] {
  return [...rooms.values()];
}
