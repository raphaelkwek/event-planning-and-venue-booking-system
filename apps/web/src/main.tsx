import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@atlaskit/css-reset";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
