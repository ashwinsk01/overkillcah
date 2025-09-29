const express = require("express");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const {
  MessageType,
  deserializeMessage,
  createMessage,
} = require("./shared/messages.js");

// Add HAND_UPDATE to MessageType
MessageType.HAND_UPDATE = 11;

const app = express();
const port = 8080;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Special route to serve decompressed cards data
app.get("/binaries/cards.json.bin.decompressed", (req, res) => {
  const brotli = require("brotli");

  try {
    const compressedData = fs.readFileSync(
      path.join(__dirname, "binaries/cards.json.bin.br"),
    );
    const decompressed = brotli.decompress(compressedData);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", decompressed.length);
    res.send(Buffer.from(decompressed));
  } catch (error) {
    console.error("Error decompressing cards data:", error);
    res.status(500).send("Error decompressing data");
  }
});

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`HTTP server running on http://localhost:${port}`);
});

// WebSocket server on port 8081
const wss = new WebSocket.Server(
  {
    port: 8081,
  },
  () => {
    console.log(`WebSocket server running on ws://localhost:8081`);
  },
);

// Load card data
let cardData = null;
function loadCardData() {
  try {
    const compressedData = fs.readFileSync(
      path.join(__dirname, "binaries/cards.json.bin.br"),
    );
    const brotli = require("brotli");
    const decompressed = brotli.decompress(compressedData);

    // Parse binary format
    const magic = new TextDecoder().decode(decompressed.slice(0, 4));
    if (magic !== "CAHJ") {
      throw new Error("Invalid binary format");
    }

    const length = new DataView(
      decompressed.slice(4, 8).buffer,
      decompressed.slice(4, 8).byteOffset,
    ).getUint32(0, true);
    const jsonBytes = decompressed.slice(8, 8 + length);
    const jsonText = new TextDecoder().decode(jsonBytes);
    cardData = JSON.parse(jsonText);

    console.log(`Loaded ${cardData.cards.length} cards for game engine`);
  } catch (error) {
    console.error("Failed to load card data:", error);
    // Fallback to CSV
    loadCardDataFromCSV();
  }
}

function loadCardDataFromCSV() {
  try {
    const csvText = fs.readFileSync(
      path.join(__dirname, "prep/eee75ea1clean.csv"),
      "utf-8",
    );
    const lines = csvText.split("\n");
    const cards = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = parseCSVLine(line);
      if (parts.length < 2) continue;
      const typeStr = parts[0];
      const text = parts.slice(1).join(",");
      const type = typeStr === "Prompt" ? 0 : 1;
      cards.push({ id: i, text, type });
    }

    cardData = { cards };
    console.log(`Loaded ${cards.length} cards from CSV fallback`);
  } catch (error) {
    console.error("Failed to load CSV data:", error);
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.replace(/"/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.replace(/"/g, ""));
  return result;
}

// Game constants
const HAND_SIZE = 10;
const WINNING_SCORE = 10;

// Game phases
const PHASES = {
  WAITING: "waiting",
  DEALING: "dealing",
  PLAYING: "playing",
  JUDGING: "judging",
  SCORING: "scoring",
  GAME_OVER: "game_over",
};

// Room state structure:
// {
//   players: Map(ws => { name, hand: [], score: 0, connected: true }),
//   gameState: {
//     phase: PHASES.WAITING,
//     currentRound: {
//       czarIndex: 0,
//       blackCard: null,
//       playedCards: Map(playerWs => [cardIds]),
//       revealedCards: [],
//       winner: null
//     },
//     deck: {
//       whiteCards: [cardIds],
//       blackCards: [cardIds],
//       whiteDiscard: [cardIds],
//       blackDiscard: [cardIds]
//     }
//   }
// }
const rooms = new Map();

// Initialize card data
loadCardData();

wss.on("connection", (ws) => {
  console.log("New connection");

  ws.on("message", (message) => {
    try {
      // Handle both binary and JSON messages for backward compatibility
      let data;
      if (
        message instanceof Buffer ||
        message instanceof ArrayBuffer ||
        message instanceof Uint8Array
      ) {
        // Binary message
        const buffer =
          message instanceof Buffer
            ? message.buffer.slice(
                message.byteOffset,
                message.byteOffset + message.byteLength,
              )
            : message;
        const parsed = deserializeMessage(buffer);
        console.log(
          "Received binary message - type:",
          parsed.type,
          "mapped to:",
          getMessageTypeString(parsed.type),
          "data:",
          parsed.data,
        );
        data = { type: getMessageTypeString(parsed.type), ...parsed.data };
      } else {
        // JSON message (fallback)
        data = JSON.parse(message);
        console.log("Received JSON message - data:", data);
      }
      console.log("Calling handleMessage with:", data);
      handleMessage(ws, data);
    } catch (err) {
      console.error("Invalid message:", err);
      ws.send(createMessage.error("Invalid message format"));
    }
  });

  ws.on("close", () => {
    // Remove from room
    for (const [roomId, room] of rooms) {
      for (const [client, playerData] of room.players) {
        if (client === ws) {
          playerData.connected = false;
          const playerLeftMessage = createMessage.playerLeft(playerData.name);
          broadcast(roomId, playerLeftMessage);

          // Check if game should pause or end
          checkGameContinuity(roomId);
          break;
        }
      }
    }
  });
});

// Helper function to convert message type number to string
function getMessageTypeString(typeNum) {
  const typeMap = {
    [MessageType.JOIN_ROOM]: "join",
    [MessageType.LEAVE_ROOM]: "leave",
    [MessageType.SELECT_CARD]: "selectCard",
    [MessageType.PLAYER_JOINED]: "playerJoined",
    [MessageType.PLAYER_LEFT]: "playerLeft",
    [MessageType.CARD_SELECTED]: "cardSelected",
    [MessageType.GAME_STATE]: "gameState",
    [MessageType.ERROR]: "error",
    [MessageType.START_GAME]: "startGame",
    [MessageType.JUDGE_CARD]: "judgeCard",
  };
  return typeMap[typeNum] || "unknown";
}

function handleMessage(ws, data) {
  switch (data.type) {
    case "join":
      joinRoom(ws, data.roomId, data.playerName);
      break;
    case "leave":
      leaveRoom(ws);
      break;
    case "startGame":
      startGame(ws);
      break;
    case "selectCard":
      selectCard(ws, data.cardId);
      break;
    case "judgeCard":
      judgeCard(ws, data.winningPlayerName);
      break;
    default:
      console.log("Unknown message type:", data.type);
  }
}

function joinRoom(ws, roomId, playerName) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      players: new Map(),
      gameState: {
        phase: PHASES.WAITING,
        currentRound: null,
        deck: initializeDeck(),
      },
    });
  }

  const room = rooms.get(roomId);
  room.players.set(ws, {
    name: playerName,
    hand: [],
    score: 0,
    connected: true,
  });
  ws.roomId = roomId;

  // Send join confirmation
  const joinedMessage = createMessage.gameState({
    type: "joined",
    roomId,
    players: Array.from(room.players.values()).map((p) => ({
      name: p.name,
      score: p.score,
      connected: p.connected,
    })),
    gameState: room.gameState,
  });
  ws.send(joinedMessage);

  // Broadcast to others
  // Broadcast to others using binary format
  const playerJoinedMessage = createMessage.playerJoined(
    playerName,
    Array.from(room.players.values()).map((p) => p.name),
  );
  broadcast(roomId, playerJoinedMessage, ws);

  // Broadcast updated game state to all players
  broadcastGameState(roomId);

  // Auto-start game when 3 players have joined
  if (room.gameState.phase === PHASES.WAITING && room.players.size === 3) {
    console.log("Auto-starting game with 3 players");
    // Start the game automatically
    room.gameState.phase = PHASES.DEALING;
    shuffleDeck(room.gameState.deck);

    // Deal initial hands
    for (const [client, playerData] of room.players) {
      playerData.hand = dealCards(room.gameState.deck.whiteCards, HAND_SIZE);
      playerData.score = 0;

      // Send hand to player
      const handMessage = createMessage.handUpdate(playerData.hand);
      client.send(handMessage);
    }

    // Start first round
    startNewRound(roomId);

    // Broadcast game start
    broadcastGameState(roomId);
  }
}

function leaveRoom(ws) {
  const roomId = ws.roomId;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const playerData = room.players.get(ws);

  if (playerData) {
    room.players.delete(ws);
    const playerLeftMessage = createMessage.playerLeft(playerData.name);
    broadcast(roomId, playerLeftMessage);

    // If room is empty, clean up
    if (room.players.size === 0) {
      rooms.delete(roomId);
    } else {
      checkGameContinuity(roomId);
      // Broadcast updated game state to remaining players
      broadcastGameState(roomId);
    }
  }
}

function startGame(ws) {
  const roomId = ws.roomId;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);

  // Only allow start if in waiting phase and enough players
  if (room.gameState.phase !== PHASES.WAITING || room.players.size < 3) {
    ws.send(createMessage.error("Need at least 3 players to start"));
    return;
  }

  // Initialize game
  room.gameState.phase = PHASES.DEALING;
  shuffleDeck(room.gameState.deck);

  // Deal initial hands
  for (const [client, playerData] of room.players) {
    playerData.hand = dealCards(room.gameState.deck.whiteCards, HAND_SIZE);
    playerData.score = 0;

    // Send hand to player
    const handMessage = createMessage.handUpdate(playerData.hand);
    client.send(handMessage);
  }

  // Start first round
  startNewRound(roomId);

  // Broadcast game start
  broadcastGameState(roomId);
}

function startNewRound(roomId) {
  const room = rooms.get(roomId);
  room.gameState.phase = PHASES.PLAYING;

  // Rotate card czar using player names for robustness
  const players = Array.from(room.players.values()).filter((p) => p.connected);
  if (!room.gameState.currentRound) {
    room.gameState.currentRound = { czarName: players[0].name };
  } else {
    const currentCzarIndex = players.findIndex(
      (p) => p.name === room.gameState.currentRound.czarName,
    );
    const nextCzarIndex = (currentCzarIndex + 1) % players.length;
    room.gameState.currentRound.czarName = players[nextCzarIndex].name;
  }

  // Deal black card
  room.gameState.currentRound.blackCard = room.gameState.deck.blackCards.pop();

  // Reset round state
  room.gameState.currentRound.playedCards = new Map();
  room.gameState.currentRound.revealedCards = [];
  room.gameState.currentRound.winner = null;

  // Fill hands if needed
  for (const [client, playerData] of room.players) {
    while (
      playerData.hand.length < HAND_SIZE &&
      room.gameState.deck.whiteCards.length > 0
    ) {
      playerData.hand.push(room.gameState.deck.whiteCards.pop());
    }

    // Send updated hand to player
    const handMessage = createMessage.handUpdate(playerData.hand);
    client.send(handMessage);
  }

  console.log(
    `Started round with czar: ${room.gameState.currentRound.czarName}`,
  );
}

function selectCard(ws, cardId) {
  const roomId = ws.roomId;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const playerData = room.players.get(ws);

  if (!playerData || room.gameState.phase !== PHASES.PLAYING) {
    return;
  }

  // Check if it's the czar's turn (czar doesn't play cards)
  if (room.gameState.currentRound.czarName === playerData.name) {
    ws.send(createMessage.error("Card czar doesn't play white cards"));
    return;
  }

  // Validate card is in hand
  const cardIndex = playerData.hand.indexOf(cardId);
  if (cardIndex === -1) {
    ws.send(createMessage.error("Card not in hand"));
    return;
  }

  // Remove card from hand and add to played cards
  playerData.hand.splice(cardIndex, 1);
  room.gameState.currentRound.playedCards.set(ws, [cardId]);

  // Send updated hand to player
  const handMessage = createMessage.handUpdate(playerData.hand);
  ws.send(handMessage);

  // Check if all non-czar players have played
  const activePlayers = Array.from(room.players.entries()).filter(
    ([client, data]) =>
      data.connected && data.name !== room.gameState.currentRound.czarName,
  );
  const expectedPlays = activePlayers.length;

  if (room.gameState.currentRound.playedCards.size >= expectedPlays) {
    // All players have played, move to judging phase
    room.gameState.phase = PHASES.JUDGING;

    // Reveal cards to czar
    room.gameState.currentRound.revealedCards = Array.from(
      room.gameState.currentRound.playedCards.entries(),
    ).map(([client, cards]) => ({
      playerName: room.players.get(client).name,
      cardIds: cards,
    }));

    // Shuffle revealed cards for fairness
    shuffleArray(room.gameState.currentRound.revealedCards);
  }

  // Broadcast card selection
  const cardSelectedMessage = createMessage.cardSelected(
    playerData.name,
    cardId,
  );
  broadcast(roomId, cardSelectedMessage);

  // Broadcast updated game state
  broadcastGameState(roomId);
}

function judgeCard(ws, winningPlayerName) {
  console.log(
    `judgeCard called by ${ws.roomId} for winner: ${winningPlayerName}`,
  );

  const roomId = ws.roomId;
  if (!roomId || !rooms.has(roomId)) {
    console.log("judgeCard: no room found");
    return;
  }

  const room = rooms.get(roomId);
  const playerData = room.players.get(ws);

  if (!playerData) {
    console.log("judgeCard: no player data");
    ws.send(createMessage.error("Player not found"));
    return;
  }

  if (room.gameState.phase !== PHASES.JUDGING) {
    console.log(`judgeCard: wrong phase ${room.gameState.phase}`);
    ws.send(createMessage.error("Not in judging phase"));
    return;
  }

  // Check if this player is the current czar
  if (room.gameState.currentRound.czarName !== playerData.name) {
    console.log(
      `judgeCard: ${playerData.name} is not czar ${room.gameState.currentRound.czarName}`,
    );
    ws.send(createMessage.error("Only the card czar can judge"));
    return;
  }

  console.log(
    `judgeCard: ${playerData.name} is judging, winner: ${winningPlayerName}`,
  );

  // Find the winning player
  let winner = null;
  for (const [client, data] of room.players) {
    if (data.name === winningPlayerName) {
      winner = data;
      break;
    }
  }

  if (!winner) {
    console.log(`judgeCard: winner ${winningPlayerName} not found`);
    ws.send(createMessage.error("Invalid winner"));
    return;
  }

  console.log(`judgeCard: awarding point to ${winner.name}`);

  // Award point and move to scoring phase
  winner.score++;
  room.gameState.currentRound.winner = winningPlayerName;
  room.gameState.phase = PHASES.SCORING;

  // Check for game end
  if (winner.score >= WINNING_SCORE) {
    room.gameState.phase = PHASES.GAME_OVER;
  }

  // Broadcast winner
  broadcastGameState(roomId);

  // If game not over, start next round after a delay
  if (room.gameState.phase !== PHASES.GAME_OVER) {
    setTimeout(() => {
      startNewRound(roomId);
      broadcastGameState(roomId);
    }, 3000); // 3 second delay
  }
}

function checkGameContinuity(roomId) {
  const room = rooms.get(roomId);
  const connectedPlayers = Array.from(room.players.values()).filter(
    (p) => p.connected,
  );

  // If fewer than 3 players, pause game
  if (connectedPlayers.length < 3 && room.gameState.phase !== PHASES.WAITING) {
    room.gameState.phase = PHASES.WAITING;
    broadcastGameState(roomId);
  }
}

function broadcastGameState(roomId) {
  const room = rooms.get(roomId);
  const players = Array.from(room.players.entries());

  // Send different game state to czar vs other players
  for (const [client, playerData] of players) {
    if (!playerData.connected || client.readyState !== WebSocket.OPEN) continue;

    const isCzar = room.gameState.currentRound?.czarName === playerData.name;

    let currentRound = room.gameState.currentRound;
    if (!isCzar && room.gameState.phase === PHASES.JUDGING) {
      // Hide revealed cards from non-czar players
      currentRound = {
        ...currentRound,
        revealedCards: null,
      };
    }

    const gameStateMessage = createMessage.gameState({
      type: "gameUpdate",
      phase: room.gameState.phase,
      currentRound: currentRound,
      players: players.map(([_, p]) => ({
        name: p.name,
        score: p.score,
        handSize: p.hand.length,
        connected: p.connected,
      })),
    });

    client.send(gameStateMessage);
  }
}

function broadcast(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const [client, data] of room.players) {
    if (
      client !== excludeWs &&
      data.connected &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(message);
    }
  }
}

// Utility functions
function initializeDeck() {
  if (!cardData)
    return {
      whiteCards: [],
      blackCards: [],
      whiteDiscard: [],
      blackDiscard: [],
    };

  const whiteCards = [];
  const blackCards = [];

  for (const card of cardData.cards) {
    if (card.type === 0) {
      // Prompt (black)
      blackCards.push(card.id);
    } else {
      // Response (white)
      whiteCards.push(card.id);
    }
  }

  return {
    whiteCards,
    blackCards,
    whiteDiscard: [],
    blackDiscard: [],
  };
}

function shuffleDeck(deck) {
  shuffleArray(deck.whiteCards);
  shuffleArray(deck.blackCards);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function dealCards(deck, count) {
  const cards = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    cards.push(deck.pop());
  }
  return cards;
}
