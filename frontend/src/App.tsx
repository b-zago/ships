import { Route, Routes } from "react-router-dom";

import Home from "./routes/Home";
import Lobby from "./routes/Lobby";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:id" element={<Lobby />} />
      </Routes>
    </>
  );
}

export default App;
