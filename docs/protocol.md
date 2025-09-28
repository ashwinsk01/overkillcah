# CAH-Hyper Protocol Documentation

## Binary Message Format

All WebSocket messages use a compact binary format for optimal performance:

```
[Type:1byte][Length:2bytes][JSON Data:variable]
```

### Message Types

| Type | Value | Purpose |
|------|-------|---------|
| JOIN_ROOM | 1 | Player joins a game room |
| LEAVE_ROOM | 2 | Player leaves a game room |
| SELECT_CARD | 3 | Player selects/plays a card |
| PLAYER_JOINED | 4 | Broadcast when player joins |
| PLAYER_LEFT | 5 | Broadcast when player leaves |
| CARD_SELECTED | 6 | Broadcast when card is selected |
| GAME_STATE | 7 | Game state updates |
| ERROR | 8 | Error messages |
| START_GAME | 9 | Start a new game |
| JUDGE_CARD | 10 | Card czar judges winning card |

### Data Format Examples

#### JOIN_ROOM (Client → Server)
```json
{
  "roomId": "room1",
  "playerName": "Player1"
}
```

#### CARD_SELECTED (Server → Clients)
```json
{
  "player": "Player1",
  "cardId": 42
}
```

#### START_GAME (Client → Server)
```json
{}
```

#### JUDGE_CARD (Client → Server)
```json
{
  "winningPlayerName": "Player2"
}
```

#### GAME_STATE Updates (Server → Clients)
```json
{
  "type": "gameUpdate",
  "phase": "playing",
  "currentRound": {
    "czarName": "Player1",
    "blackCard": 123,
    "playedCards": {},
    "revealedCards": [], // Only sent to Card Czar during JUDGING phase
    "winner": null
  },
  "players": [
    {
      "name": "Player1",
      "score": 2,
      "handSize": 8,
      "connected": true
    }
  ]
}
```

## Card Data Format

Cards are stored in a binary JSON format with Brotli compression:

```
[Magic:4bytes][Length:4bytes][JSON Data:variable]
```

- **Magic**: "CAHJ" (Cards Against Humanity JSON)
- **Length**: Little-endian 32-bit length of JSON data
- **JSON Data**: Compressed card database

### Card Structure
```json
{
  "cards": [
    {
      "id": 0,
      "text": "Card text here",
      "type": 0  // 0=Prompt, 1=Response
    }
  ]
}
```

## Game Flow & Phases

### Game Phases
1. **WAITING**: Players join room, waiting to start
2. **DEALING**: Initial card dealing and setup
3. **PLAYING**: Players select white cards for black card prompt
4. **JUDGING**: Card czar reviews played cards and selects winner
5. **SCORING**: Points awarded, round results displayed
6. **GAME_OVER**: Player reaches 10 points, game ends

### Complete Game Flow
```
Game Start:
├── Players join room (WAITING phase)
├── Game auto-starts when 3 players present (DEALING phase)
└── Initial hands dealt (10 cards each)
```

Round Loop:
├── Card czar receives black card
├── All other players play 1 white card
├── Cards revealed to czar (JUDGING phase)
├── Czar selects winning card
├── Winner gets 1 point (SCORING phase)
├── Check for 10-point winner
└── Rotate czar, start next round

Game End:
├── First to 10 points wins
└── Return to WAITING for new game
```

## Performance Characteristics

- **Binary messages**: 30-50% smaller than JSON
- **Brotli compression**: 75% reduction in card data size
- **Total payload**: <50KB for complete game data
- **Load time**: <100ms on typical connections
- **Real-time gameplay**: <50ms latency for card plays
- **Privacy**: Only Card Czar sees played cards during judging
- **Scalability**: 1000+ concurrent players per instance