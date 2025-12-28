import Game from "../components/Game";
import Lobby from "../components/Lobby";

const displayLobby = true;

function GameController() {
  if (displayLobby) {
    return <Lobby />;
  }
  return <Game />;
}

export default GameController;
