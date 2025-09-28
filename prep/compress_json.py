#!/usr/bin/env python3
"""
Compress the binary JSON with Brotli
"""

import brotli

def compress_file_brotli(input_file, output_file, quality=11):
    with open(input_file, "rb") as f:
        data = f.read()

    compressed = brotli.compress(data, quality=quality)

    with open(output_file, "wb") as f:
        f.write(compressed)
    
    compression_ratio = len(compressed) / len(data) * 100
    print(f"Compressed {input_file} -> {output_file}")
    print(f"Original: {len(data)} bytes, Compressed: {len(compressed)} bytes ({compression_ratio:.1f}%)")

if __name__ == "__main__":
    compress_file_brotli("cards.json.bin", "cards.json.bin.br")