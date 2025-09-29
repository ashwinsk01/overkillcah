# Overkill Cards Against Humanity 🎴⚡

Welcome to the fastest, leanest Cards Against Humanity game on the web! This isn't your grandma's card game – it's a hyper-optimized multiplayer machine that loads in under 35KB and delivers lols at lightning speed.

Built for the most inappropriate party game, now with zero excuses for lag.

## 🚀 Quick Start

1. **Clone & Install:**
   ```bash
   git clone <your-repo-url>
   cd overkillcah
   npm install
   ```

2. **Build & Run:**
   ```bash
   npm run build
   npm start
   ```

3. **Play:** Open `http://localhost:8080` in your browser. Grab friends, join a room, and let the chaos begin!

## 🔥 Features

- **Blazing Fast:** Under 20KB payload. Loads faster than you can say "that's inappropriate."
- **Real-Time Multiplayer:** WebSockets for instant, lag-free card-slinging.
- **Canvas Magic:** Smooth rendering without the DOM drama.
- **Binary Wizardry:** Compressed cards, efficient messaging – because who needs bloat?
- **Auto-Start:** Game kicks off when 3+ players join!

## ⚠️ Warning

This is Cards Against Humanity. Expect offensive, hilarious, and utterly wrong content. Play at your own risk – and with consenting adults only.

## 🛠️ Tech Stack

- **Frontend:** Vanilla JS + Canvas (because frameworks are for quitters)
- **Backend:** Node.js + WebSockets
- **Data:** Binary-compressed cards (Brotli + Cap'n Proto vibes)
- **Goal:** Prove that fun doesn't need to be heavy.

## 📊 Technical Architecture

Well here's the tech specs I guess.

```mermaid
graph TD
    A["User Browser\nTech: Web Browser\nPerformance: Loads <35KB total"] -->|HTTP Initial Load| B["Node.js Backend Server\nTech: Node.js\nPerformance: Lightweight, no heavy frameworks"]
    A -->|WebSocket Connection| C["WebSocket Handler\nTech: WebSockets\nPerformance: Real-time, lag-free messaging\nSavings: Eliminates polling overhead"]
    B -->|Serves| D["Frontend Bundle\nTech: Vanilla JS + Canvas\nPerformance: <20KB payload\nSavings: Minimal bundle size for fast loads"]
    D -->|Renders| E["Canvas Renderer\nTech: Canvas API\nPerformance: Smooth rendering\nSavings: No DOM manipulation overhead"]
    C -->|Manages| F["Game Logic\nTech: Node.js\nPerformance: Auto-starts at 3+ players\nEfficiency: Seamless game initiation"]
    G["Binary Compressed Cards\nTech: Binary compression (Brotli + Capn Proto vibes)\nPerformance: Efficient data transfer\nSavings: Reduced bandwidth and processing"]
    E -->|Displays| H["Game UI\nTech: Canvas-based\nPerformance: Instant updates\nSavings: Optimized for real-time interactions"]

```

Built for speed, laughs, and that sweet, sweet efficiency high. Contribute if you're as obsessed with optimization as I apparently am :)

*(P.S. First to 10 points wins. Or cries. Your call.)*

**Cards Against Humanity** is a trademark of Cards Against Humanity LLC. This project is not affiliated with or endorsed by Cards Against Humanity LLC. Built for fun while absolutely pasted.
