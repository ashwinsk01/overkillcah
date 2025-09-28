/**
 * TypeScript bindings for cards.capnp
 * Generated manually to avoid capnpc-ts compatibility issues
 */

import * as capnp from 'capnp-ts';

export enum CardType {
  PROMPT = 0,
  RESPONSE = 1
}

export interface Card {
  id: number;
  text: string;
  type: CardType;
}

export interface CardDatabase {
  cards: Card[];
}

/**
 * Parse Cap'n Proto card database from binary data
 */
export function parseCardDatabase(buffer: ArrayBuffer): CardDatabase {
  const message = new capnp.Message(buffer, false);
  const root = message.getRoot(capnp.AnyPointer);
  
  // Parse the struct manually since we don't have generated bindings
  const cardList = root.getPointer(0).getList(capnp.AnyPointer);
  const cards: Card[] = [];
  
  for (let i = 0; i < cardList.getLength(); i++) {
    const cardStruct = cardList.get(i).getStruct();
    const card: Card = {
      id: cardStruct.getUint32(0),
      text: cardStruct.getPointer(0).getText(),
      type: cardStruct.getUint16(4) as CardType
    };
    cards.push(card);
  }
  
  return { cards };
}

/**
 * Create a lookup map from card database
 */
export function createCardMap(database: CardDatabase): Map<number, Card> {
  const cardMap = new Map<number, Card>();
  for (const card of database.cards) {
    cardMap.set(card.id, card);
  }
  return cardMap;
}