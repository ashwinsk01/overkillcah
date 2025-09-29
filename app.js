const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const loading = document.getElementById("loading");

// Game UI elements
const startButton = document.createElement("button");
startButton.textContent = "Start Game";
startButton.style.position = "absolute";
startButton.style.top = "20px";
startButton.style.right = "20px";
startButton.style.padding = "10px 20px";
startButton.style.display = "none";
document.body.appendChild(startButton);

const statusDiv = document.createElement("div");
statusDiv.style.position = "absolute";
statusDiv.style.top = "20px";
statusDiv.style.left = "20px";
statusDiv.style.color = "white";
statusDiv.style.fontFamily = "monospace";
statusDiv.style.fontSize = "16px";
document.body.appendChild(statusDiv);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Card type constants
const CardType = { prompt: 0, response: 1 };

// Game phases
const PHASES = {
  WAITING: "waiting",
  DEALING: "dealing",
  PLAYING: "playing",
  JUDGING: "judging",
  SCORING: "scoring",
  GAME_OVER: "game_over",
};

// Message utilities for binary WebSocket communication
const MessageType = {
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

function serializeMessage(type, data = {}) {
  const encoder = new TextEncoder();
  const jsonStr = JSON.stringify(data);
  const jsonBytes = encoder.encode(jsonStr);

  const buffer = new ArrayBuffer(3 + jsonBytes.length);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  view.setUint8(0, type);
  view.setUint16(1, jsonBytes.length, true);
  uint8View.set(jsonBytes, 3);

  return buffer;
}

function deserializeMessage(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();

  const type = view.getUint8(0);
  const length = view.getUint16(1, true);
  const dataBytes = new Uint8Array(buffer, 3, length);
  const jsonStr = decoder.decode(dataBytes);
  const data = JSON.parse(jsonStr);

  return { type, data };
}

// Game state
let cardMap = new Map();
let ws = null;
let currentRoom = null;
let playerName = null;
let gameState = {
  phase: "waiting",
  players: [],
  myHand: [],
  selectedCards: [],
};

// WebSocket reconnection variables
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectTimeout = null;

async function loadCards() {
  try {
    // Try to load server-decompressed data first (most efficient)
    console.log("Loading cards from server-decompressed binary...");
    let response = await fetch("binaries/cards.json.bin.decompressed");
    let decompressed;

    if (response.ok) {
      decompressed = new Uint8Array(await response.arrayBuffer());
      console.log("Loaded server-decompressed data size:", decompressed.length);
    } else {
      console.log(
        "Server decompression not available, trying uncompressed binary...",
      );
      // Fallback to uncompressed version
      response = await fetch("binaries/cards.json.bin");
      if (!response.ok) throw new Error("Failed to load binary data");

      decompressed = new Uint8Array(await response.arrayBuffer());
      console.log("Loaded uncompressed binary size:", decompressed.length);
    }

    // Parse binary format: magic header (4 bytes) + length (4 bytes) + JSON data
    const magic = new TextDecoder().decode(decompressed.slice(0, 4));
    if (magic !== "CAHJ") {
      throw new Error("Invalid binary format");
    }

    // Read length (little-endian 32-bit int)
    const lengthBytes = decompressed.slice(4, 8);
    const length = new DataView(
      lengthBytes.buffer,
      lengthBytes.byteOffset,
    ).getUint32(0, true);

    // Extract and parse JSON
    const jsonBytes = decompressed.slice(8, 8 + length);
    const jsonText = new TextDecoder().decode(jsonBytes);
    const data = JSON.parse(jsonText);

    console.log(`Loaded ${data.cards.length} cards from binary format`);

    // Build lookup map
    for (let card of data.cards) {
      cardMap.set(card.id, { text: card.text, type: card.type });
    }

    loading.style.display = "none";
    return cardMap;
  } catch (error) {
    console.error("Error loading cards:", error);
    loading.textContent = "Error loading cards: " + error.message;
    // Fallback to CSV if binary loading fails
    return loadCardsFromCSV();
  }
}

// Fallback CSV loading function
async function loadCardsFromCSV() {
  try {
    console.log("Falling back to CSV loading...");
    const response = await fetch("prep/eee75ea1clean.csv");
    if (!response.ok) throw new Error("Failed to load CSV");
    const csvText = await response.text();

    // Parse CSV (handle quoted fields)
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
      cards.push({ id: i, text, type: type });
    }

    // Build lookup map
    for (let card of cards) {
      cardMap.set(card.id, { text: card.text, type: card.type });
    }

    console.log(`Loaded ${cards.length} cards from CSV fallback`);
    loading.style.display = "none";
    return cardMap;
  } catch (error) {
    console.error("Error loading cards from CSV:", error);
    loading.textContent = "Error loading cards from all sources";
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

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update status
  updateStatusDisplay();

  // Render based on game phase
  switch (gameState.phase) {
    case PHASES.WAITING:
      renderWaitingRoom();
      break;
    case PHASES.PLAYING:
      renderPlayingPhase();
      break;
    case PHASES.JUDGING:
      renderJudgingPhase();
      break;
    case PHASES.SCORING:
    case PHASES.GAME_OVER:
      renderScoringPhase();
      break;
    default:
      renderWaitingRoom();
  }
}

function updateStatusDisplay() {
  let status = `Phase: ${gameState.phase.toUpperCase()}\n`;
  status += `Players: ${gameState.players.map((p) => `${p.name} (${p.score})`).join(", ")}\n`;

  if (gameState.phase === PHASES.WAITING) {
    if (gameState.players.length >= 3) {
      status += `Status: Game starting automatically!\n`;
    } else {
      status += `Status: Waiting for ${3 - gameState.players.length} more player(s)...\n`;
    }
  } else if (gameState.currentRound) {
    const czarName = gameState.currentRound.czarName;
    if (czarName) {
      status += `Card Czar: ${czarName}\n`;
    }

    if (gameState.currentRound.blackCard !== null) {
      const blackCard = cardMap.get(gameState.currentRound.blackCard);
      if (blackCard) {
        status += `Black Card: ${blackCard.text}\n`;
      }
    }

    if (gameState.currentRound.winner) {
      status += `Round Winner: ${gameState.currentRound.winner}\n`;
    }
  }

  statusDiv.textContent = status;
}

function renderWaitingRoom() {
  ctx.fillStyle = "#fff";
  ctx.font = "24px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    "Waiting for players...",
    canvas.width / 2,
    canvas.height / 2 - 50,
  );

  ctx.font = "16px monospace";
  ctx.fillText(
    `Connected: ${gameState.players.filter((p) => p.connected).length} players`,
    canvas.width / 2,
    canvas.height / 2,
  );

  if (gameState.players.length >= 3) {
    ctx.fillText(
      "Game starting automatically!",
      canvas.width / 2,
      canvas.height / 2 + 50,
    );
    startButton.style.display = "none";
  } else {
    ctx.fillText(
      "Waiting for more players...",
      canvas.width / 2,
      canvas.height / 2 + 50,
    );
    startButton.style.display = "none";
  }
}

function renderPlayingPhase() {
  // Show black card at top
  if (gameState.currentRound && gameState.currentRound.blackCard !== null) {
    const blackCard = cardMap.get(gameState.currentRound.blackCard);
    if (blackCard) {
      renderCard(blackCard, canvas.width / 2 - 150, 100, 300, 120, true);
    }
  }

  // Find current player
  const currentPlayerIndex = gameState.players.findIndex(
    (p) => p.name === playerName,
  );
  const isCurrentPlayerCzar = gameState.currentRound?.czarName === playerName;

  if (isCurrentPlayerCzar) {
    // Card Czar sees waiting message
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "You are the Card Czar!",
      canvas.width / 2,
      canvas.height / 2 - 50,
    );
    ctx.fillText(
      "Waiting for players to submit their cards...",
      canvas.width / 2,
      canvas.height / 2,
    );
  } else {
    // Regular players see their hand
    const handY = canvas.height - 200;
    const cardWidth = 180;
    const cardHeight = 100;
    const spacing = 10;
    const columns = 3;
    const rows = Math.ceil(gameState.myHand.length / columns);
    const totalWidth = columns * (cardWidth + spacing) - spacing;
    const totalHeight = rows * (cardHeight + spacing) - spacing;
    let startX = (canvas.width - totalWidth) / 2;
    let startY = handY - totalHeight + cardHeight;

    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "Your Hand - Click a card to play it!",
      canvas.width / 2,
      startY - 30,
    );

    for (let i = 0; i < gameState.myHand.length; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const cardId = gameState.myHand[i];
      const card = cardMap.get(cardId);
      if (card) {
        const isSelected = gameState.selectedCards.includes(cardId);
        renderCard(
          card,
          startX + col * (cardWidth + spacing),
          startY + row * (cardHeight + spacing),
          cardWidth,
          cardHeight,
          false,
          isSelected,
        );
      }
    }
  }
}

function renderJudgingPhase() {
  // Show black card
  if (gameState.currentRound && gameState.currentRound.blackCard !== null) {
    const blackCard = cardMap.get(gameState.currentRound.blackCard);
    if (blackCard) {
      renderCard(blackCard, canvas.width / 2 - 150, 100, 300, 120, true);
    }
  }

  // Find current player
  const currentPlayerIndex = gameState.players.findIndex(
    (p) => p.name === playerName,
  );
  const isCurrentPlayerCzar = gameState.currentRound?.czarName === playerName;

  if (isCurrentPlayerCzar) {
    // Only Card Czar sees the judging UI
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Choose the winning card!", canvas.width / 2, 250);

    const revealedY = 280;
    const cardWidth = 200;
    const cardHeight = 100;
    const spacing = 20;
    const totalWidth =
      gameState.currentRound.revealedCards.length * (cardWidth + spacing) -
      spacing;
    let startX = (canvas.width - totalWidth) / 2;

    for (let i = 0; i < gameState.currentRound.revealedCards.length; i++) {
      const play = gameState.currentRound.revealedCards[i];
      const card = cardMap.get(play.cardIds[0]);
      if (card) {
        renderCard(
          card,
          startX + i * (cardWidth + spacing),
          revealedY,
          cardWidth,
          cardHeight,
          false,
          false,
          true,
        );
      }
    }
  } else {
    // Other players see waiting message
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "Waiting for Card Czar to choose winner...",
      canvas.width / 2,
      canvas.height / 2,
    );
  }
}

function renderScoringPhase() {
  ctx.fillStyle = "#fff";
  ctx.font = "24px monospace";
  ctx.textAlign = "center";

  if (gameState.phase === PHASES.GAME_OVER) {
    ctx.fillText("GAME OVER!", canvas.width / 2, canvas.height / 2 - 100);

    const winner = gameState.players.find((p) => p.score >= 10);
    if (winner) {
      ctx.fillText(
        `${winner.name} wins with ${winner.score} points!`,
        canvas.width / 2,
        canvas.height / 2 - 50,
      );
    }
  } else {
    ctx.fillText("Round Complete!", canvas.width / 2, canvas.height / 2 - 50);
    if (gameState.currentRound && gameState.currentRound.winner) {
      ctx.fillText(
        `${gameState.currentRound.winner} wins the round!`,
        canvas.width / 2,
        canvas.height / 2,
      );
    }
  }

  // Show final scores
  ctx.font = "18px monospace";
  let scoreY = canvas.height / 2 + 50;
  gameState.players.forEach((player) => {
    ctx.fillText(
      `${player.name}: ${player.score} points`,
      canvas.width / 2,
      scoreY,
    );
    scoreY += 30;
  });
}

function renderCard(
  card,
  x,
  y,
  width,
  height,
  isBlack = false,
  isSelected = false,
  showJudgeButton = false,
) {
  // Card background
  ctx.fillStyle = isBlack ? "#000" : "#fff";
  if (isSelected) ctx.fillStyle = "#4CAF50"; // Green for selected
  ctx.fillRect(x, y, width, height);

  // Border
  ctx.strokeStyle = isBlack ? "#fff" : "#000";
  ctx.lineWidth = isSelected ? 3 : 1;
  ctx.strokeRect(x, y, width, height);

  // Text
  ctx.fillStyle = isBlack ? "#fff" : "#000";
  ctx.font = "14px monospace";
  ctx.textAlign = "center";

  const words = card.text.split(" ");
  let line = "";
  let lineY = y + 25;
  const maxWidth = width - 20;

  for (let word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line, x + width / 2, lineY);
      line = word + " ";
      lineY += 18;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x + width / 2, lineY);

  // Judge button for czar
  if (showJudgeButton) {
    ctx.fillStyle = "#FF5722";
    ctx.fillRect(x, y + height - 25, width, 25);
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText("CHOOSE WINNER", x + width / 2, y + height - 8);
  }
}

function getCardAtPosition(x, y) {
  // Check hand cards during playing phase (only for non-czar players)
  if (gameState.phase === PHASES.PLAYING) {
    const currentPlayerIndex = gameState.players.findIndex(
      (p) => p.name === playerName,
    );
    const isCurrentPlayerCzar = gameState.currentRound?.czarName === playerName;

    if (!isCurrentPlayerCzar) {
      const handY = canvas.height - 200;
      const cardWidth = 180;
      const cardHeight = 100;
      const spacing = 10;
      const columns = 3;
      const rows = Math.ceil(gameState.myHand.length / columns);
      const totalWidth = columns * (cardWidth + spacing) - spacing;
      const totalHeight = rows * (cardHeight + spacing) - spacing;
      const startX = (canvas.width - totalWidth) / 2;
      const startY = handY - totalHeight + cardHeight;

      for (let i = 0; i < gameState.myHand.length; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const cardX = startX + col * (cardWidth + spacing);
        const cardY = startY + row * (cardHeight + spacing);
        if (
          x >= cardX &&
          x <= cardX + cardWidth &&
          y >= cardY &&
          y <= cardY + cardHeight
        ) {
          return { type: "hand", index: i, cardId: gameState.myHand[i] };
        }
      }
    }
  }

  // Check revealed cards during judging phase - only if current player is czar
  if (
    gameState.phase === PHASES.JUDGING &&
    gameState.currentRound &&
    gameState.currentRound.revealedCards
  ) {
    const currentPlayerIndex = gameState.players.findIndex(
      (p) => p.name === playerName,
    );
    const isCurrentPlayerCzar = gameState.currentRound?.czarName === playerName;

    if (isCurrentPlayerCzar) {
      const revealedY = 280;
      const cardWidth = 200;
      const cardHeight = 100;
      const spacing = 20;
      const totalWidth =
        gameState.currentRound.revealedCards.length * (cardWidth + spacing) -
        spacing;
      const startX = (canvas.width - totalWidth) / 2;

      for (let i = 0; i < gameState.currentRound.revealedCards.length; i++) {
        const cardX = startX + i * (cardWidth + spacing);
        if (
          x >= cardX &&
          x <= cardX + cardWidth &&
          y >= revealedY &&
          y <= revealedY + cardHeight
        ) {
          return {
            type: "judge",
            index: i,
            playerName: gameState.currentRound.revealedCards[i].playerName,
          };
        }
      }
    }
  }

  return null;
}

// WebSocket connection
function connectWS() {
  ws = new WebSocket("ws://localhost:8081");

  ws.onopen = () => {
    console.log("Connected to server");
    reconnectAttempts = 0; // Reset reconnection attempts on successful connection
    // Join a room
    currentRoom = "room1";
    playerName =
      prompt("Enter your name:") || "Player" + Math.floor(Math.random() * 1000);
    const joinMessage = serializeMessage(MessageType.JOIN_ROOM, {
      roomId: currentRoom,
      playerName,
    });
    ws.send(joinMessage);
  };

  ws.onmessage = (event) => {
    try {
      // Handle binary messages
      if (event.data instanceof ArrayBuffer) {
        const parsed = deserializeMessage(event.data);
        handleWSMessage(parsed);
      } else if (event.data instanceof Blob) {
        // Convert blob to array buffer
        event.data.arrayBuffer().then((buffer) => {
          const parsed = deserializeMessage(buffer);
          handleWSMessage(parsed);
        });
      } else {
        // Fallback to JSON for backward compatibility
        const data = JSON.parse(event.data);
        handleWSMessage({ type: data.type, data: data });
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  ws.onclose = () => {
    console.log("Disconnected");
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error("WS error:", error);
  };
}

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(
      "Max reconnection attempts reached. Please refresh the page.",
    );
    alert("Connection lost. Please refresh the page to reconnect.");
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
  console.log(
    `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
  );

  reconnectTimeout = setTimeout(() => {
    console.log("Reconnecting...");
    connectWS();
  }, delay);
}

function handleWSMessage(message) {
  const { type, data } = message;

  console.log("Received message - type:", type, "data:", data);

  switch (type) {
    case MessageType.GAME_STATE:
      if (data.type === "joined") {
        console.log("Joined room:", data.roomId, "Players:", data.players);
        gameState.players = data.players || [];
      } else if (data.type === "gameUpdate") {
        gameState.phase = data.phase;
        gameState.currentRound = data.currentRound;
        gameState.players = data.players || [];

        // Update my hand if provided
        if (data.myHand) {
          gameState.myHand = data.myHand;
        }

        console.log("Game state update:", gameState);
        render();
      }
      break;
    case MessageType.PLAYER_JOINED:
      console.log("Player joined:", data.player);
      // Game state update will follow immediately with full player list
      break;
    case MessageType.PLAYER_LEFT:
      console.log("Player left:", data.player);
      // Game state update will follow immediately with updated player list
      break;
    case MessageType.CARD_SELECTED:
      console.log("Card selected by", data.player, ":", data.cardId);
      break;
    case MessageType.HAND_UPDATE:
      console.log("Hand update:", data.hand);
      gameState.myHand = data.hand;
      render();
      break;
    case MessageType.ERROR:
      console.error("Server error:", data.message);
      alert("Error: " + data.message);
      break;
    default:
      console.log("Unknown message type:", type, "full message:", message);
  }
}

// Event handlers - game now auto-starts when 3 players join

canvas.addEventListener("click", (event) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const clickedCard = getCardAtPosition(x, y);

  if (clickedCard) {
    console.log("Clicked card:", clickedCard);
    if (clickedCard.type === "hand" && gameState.phase === PHASES.PLAYING) {
      // Play a card from hand
      console.log("Playing card from hand:", clickedCard.cardId);
      const selectMessage = serializeMessage(MessageType.SELECT_CARD, {
        cardId: clickedCard.cardId,
      });
      ws.send(selectMessage);
      gameState.selectedCards = [clickedCard.cardId];
      render();
    } else if (
      clickedCard.type === "judge" &&
      gameState.phase === PHASES.JUDGING
    ) {
      // Judge a winning card
      console.log("Judging winner:", clickedCard.playerName);
      const judgeMessage = serializeMessage(MessageType.JUDGE_CARD, {
        winningPlayerName: clickedCard.playerName,
      });
      ws.send(judgeMessage);
    } else {
      console.log(
        "Unhandled click - type:",
        clickedCard.type,
        "phase:",
        gameState.phase,
      );
    }
  } else {
    console.log("No card clicked at position");
  }
});

// Handle resize
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
});

// Start app
loadCards().then(() => {
  connectWS();
  render();
});
