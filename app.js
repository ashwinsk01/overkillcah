const c = document.getElementById("gameCanvas");
const x = c.getContext("2d");
const l = document.getElementById("loading");

// Game UI elements
const s = document.createElement("button");
s.textContent = "Start Game";
s.style.position = "absolute";
s.style.top = "20px";
s.style.right = "20px";
s.style.padding = "10px 20px";
s.style.display = "none";
document.body.appendChild(s);

const d = document.createElement("div");
d.style.position = "absolute";
d.style.top = "20px";
d.style.left = "20px";
d.style.color = "white";
d.style.fontFamily = "monospace";
d.style.fontSize = "16px";
document.body.appendChild(d);

c.width = window.innerWidth;
c.height = window.innerHeight;

// Card type constants
const CT = { p: 0, r: 1 };

// Game phases
const P = {
  W: "waiting",
  D: "dealing",
  Y: "playing",
  J: "judging",
  S: "scoring",
  G: "game_over",
};

// Message utilities for binary WebSocket communication
const MT = {
  JR: 1,
  LR: 2,
  SC: 3,
  PJ: 4,
  PL: 5,
  CS: 6,
  GS: 7,
  E: 8,
  SG: 9,
  JC: 10,
  HU: 11,
};

function sm(type, data = {}) {
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

function dm(buffer) {
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
let cm = new Map();
let ws = null;
let cr = null;
let pn = null;
let gs = {
  phase: "waiting",
  players: [],
  myHand: [],
  selectedCards: [],
};

// WebSocket reconnection variables
let ra = 0;
const mra = 5;
let rt = null;

async function lc() {
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
      cm.set(card.id, { text: card.text, type: card.type });
    }

    l.style.display = "none";
    return cm;
  } catch (error) {
    console.error("Error loading cards:", error);
    l.textContent = "Error loading cards: " + error.message;
    // Fallback to CSV if binary loading fails
    return lcf();
  }
}

// Fallback CSV loading function
async function lcf() {
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
      const parts = pcl(line);
      if (parts.length < 2) continue;
      const typeStr = parts[0];
      const text = parts.slice(1).join(",");
      const type = typeStr === "Prompt" ? 0 : 1;
      cards.push({ id: i, text, type: type });
    }

    // Build lookup map
    for (let card of cards) {
      cm.set(card.id, { text: card.text, type: card.type });
    }

    console.log(`Loaded ${cards.length} cards from CSV fallback`);
    l.style.display = "none";
    return cm;
  } catch (error) {
    console.error("Error loading cards from CSV:", error);
    l.textContent = "Error loading cards from all sources";
  }
}

function pcl(line) {
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

function r() {
  x.clearRect(0, 0, c.width, c.height);

  // Update status
  usd();

  // Render based on game phase
  switch (gs.phase) {
    case P.W:
      rwr();
      break;
    case P.Y:
      rpp();
      break;
    case P.J:
      rjp();
      break;
    case P.S:
    case P.G:
      rsp();
      break;
    default:
      rwr();
  }
}

function usd() {
  let status = `Phase: ${gs.phase.toUpperCase()}\n`;
  status += `Players: ${gs.players.map((p) => `${p.name} (${p.score})`).join(", ")}\n`;

  if (gs.phase === P.W) {
    if (gs.players.length >= 3) {
      status += `Status: Game starting automatically!\n`;
    } else {
      status += `Status: Waiting for ${3 - gs.players.length} more player(s)...\n`;
    }
  } else if (gs.currentRound) {
    const czarName = gs.currentRound.czarName;
    if (czarName) {
      status += `Card Czar: ${czarName}\n`;
    }

    if (gs.currentRound.blackCard !== null) {
      const blackCard = cm.get(gs.currentRound.blackCard);
      if (blackCard) {
        status += `Black Card: ${blackCard.text}\n`;
      }
    }

    if (gs.currentRound.winner) {
      status += `Round Winner: ${gs.currentRound.winner}\n`;
    }
  }

  d.textContent = status;
}

function rwr() {
  x.fillStyle = "#fff";
  x.font = "24px monospace";
  x.textAlign = "center";
  x.fillText("Waiting for players...", c.width / 2, c.height / 2 - 50);

  x.font = "16px monospace";
  x.fillText(
    `Connected: ${gs.players.filter((p) => p.connected).length} players`,
    c.width / 2,
    c.height / 2,
  );

  if (gs.players.length >= 3) {
    x.fillText("Game starting automatically!", c.width / 2, c.height / 2 + 50);
    s.style.display = "none";
  } else {
    x.fillText("Waiting for more players...", c.width / 2, c.height / 2 + 50);
    s.style.display = "none";
  }
}

function rpp() {
  // Show black card at top
  if (gs.currentRound && gs.currentRound.blackCard !== null) {
    const blackCard = cm.get(gs.currentRound.blackCard);
    if (blackCard) {
      rc(blackCard, c.width / 2 - 150, 100, 300, 120, true);
    }
  }

  // Find current player
  const currentPlayerIndex = gs.players.findIndex((p) => p.name === pn);
  const isCurrentPlayerCzar = gs.currentRound?.czarName === pn;

  if (isCurrentPlayerCzar) {
    // Card Czar sees waiting message
    x.fillStyle = "#fff";
    x.font = "18px monospace";
    x.textAlign = "center";
    x.fillText("You are the Card Czar!", c.width / 2, c.height / 2 - 50);
    x.fillText(
      "Waiting for players to submit their cards...",
      c.width / 2,
      c.height / 2,
    );
  } else {
    // Regular players see their hand
    const handY = c.height - 200;
    const cardWidth = 180;
    const cardHeight = 100;
    const spacing = 10;
    const columns = 3;
    const rows = Math.ceil(gs.myHand.length / columns);
    const totalWidth = columns * (cardWidth + spacing) - spacing;
    const totalHeight = rows * (cardHeight + spacing) - spacing;
    let startX = (c.width - totalWidth) / 2;
    let startY = handY - totalHeight + cardHeight;

    x.fillStyle = "#fff";
    x.font = "18px monospace";
    x.textAlign = "center";
    x.fillText(
      "Your Hand - Click a card to play it!",
      c.width / 2,
      startY - 30,
    );

    for (let i = 0; i < gs.myHand.length; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const cardId = gs.myHand[i];
      const card = cm.get(cardId);
      if (card) {
        const isSelected = gs.selectedCards.includes(cardId);
        rc(
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

function rjp() {
  // Show black card
  if (gs.currentRound && gs.currentRound.blackCard !== null) {
    const blackCard = cm.get(gs.currentRound.blackCard);
    if (blackCard) {
      rc(blackCard, c.width / 2 - 150, 100, 300, 120, true);
    }
  }

  // Find current player
  const currentPlayerIndex = gs.players.findIndex((p) => p.name === pn);
  const isCurrentPlayerCzar = gs.currentRound?.czarName === pn;

  if (isCurrentPlayerCzar) {
    // Only Card Czar sees the judging UI
    x.fillStyle = "#fff";
    x.font = "18px monospace";
    x.textAlign = "center";
    x.fillText("Choose the winning card!", c.width / 2, 250);

    const revealedY = 280;
    const cardWidth = 200;
    const cardHeight = 100;
    const spacing = 20;
    const totalWidth =
      gs.currentRound.revealedCards.length * (cardWidth + spacing) - spacing;
    let startX = (c.width - totalWidth) / 2;

    for (let i = 0; i < gs.currentRound.revealedCards.length; i++) {
      const play = gs.currentRound.revealedCards[i];
      const card = cm.get(play.cardIds[0]);
      if (card) {
        rc(
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
    x.fillStyle = "#fff";
    x.font = "18px monospace";
    x.textAlign = "center";
    x.fillText(
      "Waiting for Card Czar to choose winner...",
      c.width / 2,
      c.height / 2,
    );
  }
}

function rsp() {
  x.fillStyle = "#fff";
  x.font = "24px monospace";
  x.textAlign = "center";

  if (gs.phase === P.G) {
    x.fillText("GAME OVER!", c.width / 2, c.height / 2 - 100);

    const winner = gs.players.find((p) => p.score >= 10);
    if (winner) {
      x.fillText(
        `${winner.name} wins with ${winner.score} points!`,
        c.width / 2,
        c.height / 2 - 50,
      );
    }
  } else {
    x.fillText("Round Complete!", c.width / 2, c.height / 2 - 50);
    if (gs.currentRound && gs.currentRound.winner) {
      x.fillText(
        `${gs.currentRound.winner} wins the round!`,
        c.width / 2,
        c.height / 2,
      );
    }
  }

  // Show final scores
  x.font = "18px monospace";
  let scoreY = c.height / 2 + 50;
  gs.players.forEach((player) => {
    x.fillText(`${player.name}: ${player.score} points`, c.width / 2, scoreY);
    scoreY += 30;
  });
}

function rc(
  card,
  px,
  py,
  width,
  height,
  isBlack = false,
  isSelected = false,
  showJudgeButton = false,
) {
  // Card background
  x.fillStyle = isBlack ? "#000" : "#fff";
  if (isSelected) x.fillStyle = "#4CAF50"; // Green for selected
  x.fillRect(px, py, width, height);

  // Border
  x.strokeStyle = isBlack ? "#fff" : "#000";
  x.lineWidth = isSelected ? 3 : 1;
  x.strokeRect(px, py, width, height);

  // Text
  x.fillStyle = isBlack ? "#fff" : "#000";
  x.font = "14px monospace";
  x.textAlign = "center";

  const words = card.text.split(" ");
  let line = "";
  let lineY = py + 25;
  const maxWidth = width - 20;

  for (let word of words) {
    const testLine = line + word + " ";
    if (x.measureText(testLine).width > maxWidth) {
      x.fillText(line, px + width / 2, lineY);
      line = word + " ";
      lineY += 18;
    } else {
      line = testLine;
    }
  }
  x.fillText(line, px + width / 2, lineY);

  // Judge button for czar
  if (showJudgeButton) {
    x.fillStyle = "#FF5722";
    x.fillRect(px, py + height - 25, width, 25);
    x.fillStyle = "#fff";
    x.font = "12px monospace";
    x.fillText("CHOOSE WINNER", px + width / 2, py + height - 8);
  }
}

function gcap(x, y) {
  // Check hand cards during playing phase (only for non-czar players)
  if (gs.phase === P.Y) {
    const currentPlayerIndex = gs.players.findIndex((p) => p.name === pn);
    const isCurrentPlayerCzar = gs.currentRound?.czarName === pn;

    if (!isCurrentPlayerCzar) {
      const handY = c.height - 200;
      const cardWidth = 180;
      const cardHeight = 100;
      const spacing = 10;
      const columns = 3;
      const rows = Math.ceil(gs.myHand.length / columns);
      const totalWidth = columns * (cardWidth + spacing) - spacing;
      const totalHeight = rows * (cardHeight + spacing) - spacing;
      const startX = (c.width - totalWidth) / 2;
      const startY = handY - totalHeight + cardHeight;

      for (let i = 0; i < gs.myHand.length; i++) {
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
          return { type: "hand", index: i, cardId: gs.myHand[i] };
        }
      }
    }
  }

  // Check revealed cards during judging phase - only if current player is czar
  if (gs.phase === P.J && gs.currentRound && gs.currentRound.revealedCards) {
    const currentPlayerIndex = gs.players.findIndex((p) => p.name === pn);
    const isCurrentPlayerCzar = gs.currentRound?.czarName === pn;

    if (isCurrentPlayerCzar) {
      const revealedY = 280;
      const cardWidth = 200;
      const cardHeight = 100;
      const spacing = 20;
      const totalWidth =
        gs.currentRound.revealedCards.length * (cardWidth + spacing) - spacing;
      const startX = (c.width - totalWidth) / 2;

      for (let i = 0; i < gs.currentRound.revealedCards.length; i++) {
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
            playerName: gs.currentRound.revealedCards[i].playerName,
          };
        }
      }
    }
  }

  return null;
}

// WebSocket connection
function cws() {
  ws = new WebSocket("ws://localhost:8081");

  ws.onopen = () => {
    console.log("Connected to server");
    ra = 0; // Reset reconnection attempts on successful connection
    // Join a room
    cr = "room1";
    pn =
      prompt("Enter your name:") || "Player" + Math.floor(Math.random() * 1000);
    const joinMessage = sm(MT.JR, {
      roomId: cr,
      playerName: pn,
    });
    ws.send(joinMessage);
  };

  ws.onmessage = (event) => {
    try {
      // Handle binary messages
      if (event.data instanceof ArrayBuffer) {
        const parsed = dm(event.data);
        hwsm(parsed);
      } else if (event.data instanceof Blob) {
        // Convert blob to array buffer
        event.data.arrayBuffer().then((buffer) => {
          const parsed = dm(buffer);
          hwsm(parsed);
        });
      } else {
        // Fallback to JSON for backward compatibility
        const data = JSON.parse(event.data);
        hwsm({ type: data.type, data: data });
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  ws.onclose = () => {
    console.log("Disconnected");
    ar();
  };

  ws.onerror = (error) => {
    console.error("WS error:", error);
  };
}

function ar() {
  if (ra >= mra) {
    console.error(
      "Max reconnection attempts reached. Please refresh the page.",
    );
    alert("Connection lost. Please refresh the page to reconnect.");
    return;
  }

  ra++;
  const delay = Math.min(1000 * Math.pow(2, ra), 30000); // Exponential backoff, max 30s
  console.log(`Attempting to reconnect in ${delay}ms (attempt ${ra}/${mra})`);

  rt = setTimeout(() => {
    console.log("Reconnecting...");
    cws();
  }, delay);
}

function hwsm(message) {
  const { type, data } = message;

  console.log("Received message - type:", type, "data:", data);

  switch (type) {
    case MT.GS:
      if (data.type === "joined") {
        console.log("Joined room:", data.roomId, "Players:", data.players);
        gs.players = data.players || [];
      } else if (data.type === "gameUpdate") {
        gs.phase = data.phase;
        gs.currentRound = data.currentRound;
        gs.players = data.players || [];

        // Update my hand if provided
        if (data.myHand) {
          gs.myHand = data.myHand;
        }

        console.log("Game state update:", gs);
        r();
      }
      break;
    case MT.PJ:
      console.log("Player joined:", data.player);
      // Game state update will follow immediately with full player list
      break;
    case MT.PL:
      console.log("Player left:", data.player);
      // Game state update will follow immediately with updated player list
      break;
    case MT.CS:
      console.log("Card selected by", data.player, ":", data.cardId);
      break;
    case MT.HU:
      console.log("Hand update:", data.hand);
      gs.myHand = data.hand;
      r();
      break;
    case MT.E:
      console.error("Server error:", data.message);
      alert("Error: " + data.message);
      break;
    default:
      console.log("Unknown message type:", type, "full message:", message);
  }
}

// Event handlers - game now auto-starts when 3 players join

c.addEventListener("click", (event) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const rect = c.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const clickedCard = gcap(x, y);

  if (clickedCard) {
    console.log("Clicked card:", clickedCard);
    if (clickedCard.type === "hand" && gs.phase === P.Y) {
      // Play a card from hand
      console.log("Playing card from hand:", clickedCard.cardId);
      const selectMessage = sm(MT.SC, {
        cardId: clickedCard.cardId,
      });
      ws.send(selectMessage);
      gs.selectedCards = [clickedCard.cardId];
      r();
    } else if (clickedCard.type === "judge" && gs.phase === P.J) {
      // Judge a winning card
      console.log("Judging winner:", clickedCard.playerName);
      const judgeMessage = sm(MT.JC, {
        winningPlayerName: clickedCard.playerName,
      });
      ws.send(judgeMessage);
    } else {
      console.log(
        "Unhandled click - type:",
        clickedCard.type,
        "phase:",
        gs.phase,
      );
    }
  } else {
    console.log("No card clicked at position");
  }
});

// Handle resize
window.addEventListener("resize", () => {
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  r();
});

// Start app
lc().then(() => {
  cws();
  r();
});
