/**
 * Shared message serialization for efficient WebSocket communication
 * Uses compact binary format instead of JSON for better performance
 */

// Message types
export const MessageType = {
  JOIN_ROOM: 1,
  LEAVE_ROOM: 2,
  SELECT_CARD: 3,
  PLAYER_JOINED: 4,
  PLAYER_LEFT: 5,
  CARD_SELECTED: 6,
  GAME_STATE: 7,
  ERROR: 8,
  START_GAME: 9,
  JUDGE_CARD: 10,
  HAND_UPDATE: 11,
};

// Maximum message size (64KB - 3 bytes for header)
const MAX_MESSAGE_SIZE = 65532;

/**
 * Serialize a message to binary format
 */
export function serializeMessage(type, data = {}) {
  const encoder = new TextEncoder();

  // Convert data to JSON string first, then to bytes
  const jsonStr = JSON.stringify(data);
  const jsonBytes = encoder.encode(jsonStr);

  // Check message size limit
  if (jsonBytes.length > MAX_MESSAGE_SIZE) {
    throw new Error(
      `Message too large: ${jsonBytes.length} bytes (max ${MAX_MESSAGE_SIZE})`,
    );
  }

  // Create buffer: 1 byte type + 2 bytes length + data
  const buffer = new ArrayBuffer(3 + jsonBytes.length);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Write type (1 byte)
  view.setUint8(0, type);

  // Write length (2 bytes, little-endian) - max 65535 bytes
  view.setUint16(1, jsonBytes.length, true);

  // Write data
  uint8View.set(jsonBytes, 3);

  return buffer;
}

/**
 * Deserialize a message from binary format
 */
export function deserializeMessage(buffer) {
  if (!(buffer instanceof ArrayBuffer) && !(buffer instanceof Uint8Array)) {
    throw new Error("Invalid buffer type for deserialization");
  }

  const view = new DataView(
    buffer instanceof Uint8Array ? buffer.buffer : buffer,
  );
  const decoder = new TextDecoder();

  // Read type (1 byte)
  const type = view.getUint8(0);

  // Read length (2 bytes, little-endian)
  const length = view.getUint16(1, true);

  // Validate length
  if (length > MAX_MESSAGE_SIZE) {
    throw new Error(
      `Invalid message length: ${length} bytes (max ${MAX_MESSAGE_SIZE})`,
    );
  }

  // Check buffer has enough data
  const totalExpectedSize = 3 + length;
  const actualSize =
    buffer instanceof Uint8Array ? buffer.length : buffer.byteLength;
  if (actualSize < totalExpectedSize) {
    throw new Error(
      `Incomplete message: expected ${totalExpectedSize} bytes, got ${actualSize}`,
    );
  }

  // Read data
  const dataBytes = new Uint8Array(
    buffer instanceof Uint8Array ? buffer.buffer : buffer,
    3,
    length,
  );
  const jsonStr = decoder.decode(dataBytes);
  const data = JSON.parse(jsonStr);

  return { type, data };
}

/**
 * Create specific message types
 */
export const createMessage = {
  joinRoom: (roomId, playerName) =>
    serializeMessage(MessageType.JOIN_ROOM, { roomId, playerName }),
  leaveRoom: (roomId) => serializeMessage(MessageType.LEAVE_ROOM, { roomId }),
  selectCard: (cardId) => serializeMessage(MessageType.SELECT_CARD, { cardId }),
  playerJoined: (player, players) =>
    serializeMessage(MessageType.PLAYER_JOINED, { player, players }),
  playerLeft: (player) => serializeMessage(MessageType.PLAYER_LEFT, { player }),
  cardSelected: (player, cardId) =>
    serializeMessage(MessageType.CARD_SELECTED, { player, cardId }),
  gameState: (state) => serializeMessage(MessageType.GAME_STATE, state),
  error: (message) => serializeMessage(MessageType.ERROR, { message }),
  startGame: () => serializeMessage(MessageType.START_GAME, {}),
  judgeCard: (winningPlayerName) =>
    serializeMessage(MessageType.JUDGE_CARD, { winningPlayerName }),
  handUpdate: (hand) => serializeMessage(MessageType.HAND_UPDATE, { hand }),
};

// Node.js compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MessageType,
    serializeMessage,
    deserializeMessage,
    createMessage,
  };
}
