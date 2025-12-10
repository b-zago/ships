export type Ship = {
  vertical: boolean;
  x: number;
  y: number;
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
  status: string;
};
