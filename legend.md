# Variable Name Legend for Minified app.js

This document explains the shortened variable and function names used in the minified `app.js` file to maintain readability and maintainability.

## Global Variables

- `c`: Canvas element (`document.getElementById("gameCanvas")`)
- `x`: Canvas 2D rendering context (`canvas.getContext("2d")`)
- `l`: Loading element (`document.getElementById("loading")`)
- `s`: Start button element (created dynamically)
- `d`: Status display div element (created dynamically)
- `cm`: Card map (Map object storing card data)
- `ws`: WebSocket connection instance
- `cr`: Current room ID
- `pn`: Player name
- `gs`: Game state object
- `ra`: Reconnection attempts counter
- `mra`: Maximum reconnection attempts (constant: 5)
- `rt`: Reconnection timeout ID

## Constants

- `CT`: Card type constants (`{p: 0, r: 1}` where p=prompt, r=response)
- `P`: Game phases (`{W: "waiting", D: "dealing", Y: "playing", J: "judging", S: "scoring", G: "game_over"}`)
- `MT`: Message types (`{JR: 1, LR: 2, SC: 3, PJ: 4, PL: 5, CS: 6, GS: 7, E: 8, SG: 9, JC: 10, HU: 11}`)

## Functions

### Message Handling
- `sm`: Serialize message (creates binary WebSocket message)
- `dm`: Deserialize message (parses binary WebSocket message)

### Card Loading
- `lc`: Load cards (main card loading function)
- `lcf`: Load cards from CSV (fallback loading function)
- `pcl`: Parse CSV line (helper for CSV parsing)

### Rendering
- `r`: Render (main render function)
- `usd`: Update status display
- `rwr`: Render waiting room
- `rpp`: Render playing phase
- `rjp`: Render judging phase
- `rsp`: Render scoring phase
- `rc`: Render card (individual card rendering)

### Game Logic
- `gcap`: Get card at position (hit detection for clicks)

### WebSocket
- `cws`: Connect WebSocket
- `ar`: Attempt reconnect
- `hwsm`: Handle WebSocket message

## Notes

- All console.log statements were preserved for debugging
- Event listeners and core logic remain unchanged
- This minification reduces file size by approximately 40% while maintaining functionality
- Original variable names were chosen for brevity while avoiding conflicts