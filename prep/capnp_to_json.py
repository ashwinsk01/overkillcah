#!/usr/bin/env python3
"""
Convert Cap'n Proto binary to binary JSON format for runtime use
This provides a bridge since manual Cap'n Proto parsing in JS is complex
"""

import capnp
import json
import struct


def capnp_to_binary_json(capnp_file, json_file):
    """Convert Cap'n Proto binary to binary JSON format"""

    # Load the schema and read the Cap'n Proto file
    cards_capnp = capnp.load("cards.capnp")

    with open(capnp_file, "rb") as f:
        db = cards_capnp.CardDatabase.read(f)

    # Convert to the same JSON structure used by the runtime
    cards = []
    for card in db.cards:
        cards.append(
            {
                "id": card.id,
                "text": card.text,
                "type": 0 if card.type == cards_capnp.CardType.prompt else 1,
            }
        )

    json_data = {"cards": cards}

    # Convert to binary JSON format (same as create_json_binary.py)
    json_bytes = json.dumps(json_data, separators=(",", ":")).encode("utf-8")

    with open(json_file, "wb") as f:
        # Write magic header and length
        f.write(b"CAHJ")  # Magic: Cards Against Humanity JSON
        f.write(struct.pack("<I", len(json_bytes)))  # Length (little-endian)
        f.write(json_bytes)

    print(
        f"Converted Cap'n Proto to binary JSON: {len(cards)} cards, {len(json_bytes)} bytes"
    )
    return len(json_bytes)


if __name__ == "__main__":
    size = capnp_to_binary_json("../binaries/cards.bin", "../binaries/cards.json.bin")
    print(f"Binary JSON created: cards.json.bin ({size} bytes)")
