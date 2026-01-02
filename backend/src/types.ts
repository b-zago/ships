export type Ship = {
  id: number;
  name: string;
  length: number;
  color: string;
};

export type Hit = {
  row: number;
  col: number;
};

export type Lobby = {
  id: string;
  playerAToken: string;
  playerBToken: string;
  playerAShips: Ship[] | [];
  playerBShips: Ship[] | [];
  playerAHits: Hit[] | [];
  playerBHits: Hit[] | [];
  playerTurn: "A" | "B";
  playerAReady: "0" | "1";
  playerBReady: "0" | "1";
  preparation: "0" | "1";
};

export type PlacedShip = Ship & {
  cells: Cell[];
  isHorizontal: boolean;
};

export type Cell = {
  row: number;
  col: number;
};

export type AttackResult = {
  valid: boolean;
  hit: boolean;
  shipId?: number;
  shipName?: string;
  sunk?: boolean;
  error?: string;
};

export const HitsEnum = {
  Default: 0,
  Hit: 1,
  Miss: 2,
  Ship: 3,
} as const;

export type HitsEnumType = (typeof HitsEnum)[keyof typeof HitsEnum];
