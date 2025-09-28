import csv
import capnp

cards_capnp = capnp.load("cards.capnp")


def card_type_from_str(s):
    return (
        cards_capnp.CardType.prompt if s == "Prompt" else cards_capnp.CardType.response
    )


def csv_to_capnp(csv_file, output_file):
    with open(csv_file, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)

        cards = []
        for idx, row in enumerate(reader):
            if len(row) < 2:
                continue
            card_type_str, text = row[0], row[1]
            if card_type_str not in ("Prompt", "Response"):
                continue
            cards.append((idx, text, card_type_from_str(card_type_str)))

    db = cards_capnp.CardDatabase.new_message()
    card_list = db.init("cards", len(cards))
    for i, (cid, text, ctype) in enumerate(cards):
        card = card_list[i]
        card.id = cid
        card.text = text
        card.type = ctype

    with open(output_file, "wb") as out:
        db.write(out)


csv_to_capnp("eee75ea1clean.csv", "cards.bin")
print("Capnp binary card database written to cards.bin")
