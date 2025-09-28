import brotli


def compress_file_brotli(input_file, output_file, quality=11):
    with open(input_file, "rb") as f:
        data = f.read()

    compressed = brotli.compress(data, quality=quality)

    with open(output_file, "wb") as f:
        f.write(compressed)
    print(
        f"Compressed {input_file} -> {output_file}, original size {len(data)} bytes, compressed size {len(compressed)} bytes"
    )


compress_file_brotli("cards.bin", "cards.bin.br")
