import React from "react";
import ReactDOM from "react-dom/client";
import { SpotlightChat } from "./components/spotlight/SpotlightChat";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SpotlightChat />
  </React.StrictMode>,
);
