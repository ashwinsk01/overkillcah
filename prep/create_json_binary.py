#!/usr/bin/env python3
"""
Create a simple JSON binary format that's easy to parse in JavaScript
This avoids Cap'n Proto complexity while still being efficient
"""

import json
import csv
import struct

def csv_to_binary_json(csv_file, output_file):
    """Convert CSV to compact binary JSON format"""
    cards = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for idx, row in enumerate(reader):
            if len(row) < 2:
                continue
            card_type_str, text = row[0], row[1]
            if card_type_str not in ("Prompt", "Response"):
                continue
            
            card_type = 0 if card_type_str == "Prompt" else 1
            cards.append({
                "id": idx,
                "text": text,
                "type": card_type
            })
    
    # Create compact JSON and convert to bytes
    json_data = {"cards": cards}
    json_bytes = json.dumps(json_data, separators=(',', ':')).encode('utf-8')
    
    # Write with length prefix for easier parsing
    with open(output_file, 'wb') as f:
        # Write magic header and length
        f.write(b'CAHJ')  # Magic: Cards Against Humanity JSON
        f.write(struct.pack('<I', len(json_bytes)))  # Length (little-endian)
        f.write(json_bytes)
    
    print(f"Created binary JSON: {len(cards)} cards, {len(json_bytes)} bytes")
    return len(json_bytes)

if __name__ == "__main__":
    size = csv_to_binary_json("eee75ea1clean.csv", "cards.json.bin")
    print(f"Binary JSON created: cards.json.bin ({size} bytes)")