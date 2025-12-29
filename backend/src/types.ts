export type Ship = {
  id: number;
  name: string;
  length: number;
  color: string;
};

export type Hit = {
  x: number;
  y: number;
};

export type Lobby = {
  id: string | undefined;
  playerAToken: string;
  playerBToken: string;
  playerAShips: Ship[] | [];
  playerBShips: Ship[] | [];
  playerAHits: Hit[] | [];
  playerBHits: Hit[] | [];
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
