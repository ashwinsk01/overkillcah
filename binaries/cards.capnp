@0xabcdefabcdefabcdef;

struct Card {
  id @0 :UInt32;
  text @1 :Text;
  type @2 :CardType;
}

enum CardType {
  prompt @0;
  response @1;
}

struct CardDatabase {
  cards @0 :List(Card);
}
