
# Hyper-Efficient Cards Against Humanity Web Game Architecture

## Overview
This architecture is designed to produce a fast, minimal payload, and scalable Cards Against Humanity online game. It leverages advanced serialization, compression, and networking techniques to serve the entire game efficiently under 500KB with near-instant load and minimal lag.

---

## Components & Responsibilities

### 1. Data Storage & Serialization
- Cards data (Prompt and Response cards) stored in Capn Proto binary format for speed and minimal parsing overhead.
- Card texts identified by unique integer IDs.
- Cards data compressed with Brotli for minimal network payload.
- Precomputed shuffled sequences of card IDs generated server-side for each session.

### 2. Server Side
- Serves static content: HTML, CSS, compressed JS bundles, and the compressed Capn Proto binary cards database.
- On session start, serves pre-shuffled card ID sequences ("packs").
- Manages user sessions, authentication, and game state.
- Hosts a WebSocket server for real-time gameplay communication.
- Sends minimal delta updates encoded in Capn Proto format over WebSocket.

### 3. Client Side
- Loads compressed static assets and decompresses Capn Proto card database efficiently using zero-copy parsing.
- Stores cards in an efficient lookup structure (array or hash map) keyed by card IDs.
- Uses precomputed shuffled card ID sequences to drive game logic without runtime randomizing.
- Renders UI via canvas or minimal DOM manipulation with black/white coloring for card types.
- Handles player interactions, sends commands referencing card IDs and game states through WebSocket.
- Applies delta state updates to keep UI in sync, with privacy controls (only Card Czar sees played cards during judging).

---

## Data Flow

1. **Initial Load:**
   - Client requests and receives compressed JS/CSS and Capn Proto cards data (`cards.bin.br`).
   - Client decompresses and deserializes card data, creating lookup maps.
2. **Session Start:**
   - Client receives precomputed shuffle sequences of card IDs for that session.
3. **Gameplay:**
   - Players select cards; client sends minimal messages with card IDs/actions.
   - Server synchronizes game state; sends minimal delta updates via Capn Proto over WebSocket.
   - During judging phase, only Card Czar receives revealed card data for privacy.
   4. **Real-Time Updates:**
   - Client applies updates, renders UI immediately with role-based display (czar vs players).

---

## Technologies & Tools

| Area          | Technology                  | Purpose                                            |
|---------------|----------------------------|---------------------------------------------------|
| Serialization | Capn Proto            | Binary fast schema-driven serialization           |
| Compression   | Brotli                    | Minimal payload for network efficiency             |
| Networking    | WebSocket                 | Persistent bi-directional communication            |
| Client Logic  | Vanilla JS/Svelte          | Minimal, efficient UI rendering                     |
| Server Stack  | Node.js/Go/Rust            | Lightweight server & game logic                     |
| Data Storage  | In-memory + Capn Proto files | Fast access and serving of static card data      |

---

## What is Needed From Each End

### From Engineering
- **Backend:** Build server to generate and serve precomputed card sequences; implement real-time game state sync with Capn Proto over WebSocket, including role-based data privacy.
- **Frontend:** Implement Capn Proto decompression/parsing, card lookup, UI rendering with czar-specific judging interface, and WebSocket game communication.
- **Build System:** Setup efficient bundling with minification and Brotli compression.
- **Testing:** Profile network usage, parse speed, and UI responsiveness.
- **Security:** Secure WebSocket, session management, and input validation.

### From Design
- Provide minimalistic UI design focusing on efficient rendering of black/white cards and responsive interactions.

### From DevOps
- CDN setup for static content delivery and fast Brotli compressed file serving.
- WebSocket server scaling and monitoring setup.

---

This architecture balances minimal load size, streaming efficiency, and fast user experience using cutting-edge serialization and compression with advanced networking. It is designed for scalability, extensibility (expansion card packs), and smooth real-time multiplayer gaming.

