import { Route, Routes } from "react-router-dom";

import Home from "./routes/Home";
import GameController from "./routes/GameController";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:id" element={<GameController />} />
      </Routes>
    </>
  );
}

export default App;
