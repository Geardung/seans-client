import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./design/tokens.css";
import "./design/primitives.css";
import "./design/app.css";
import { applyTheme, getTheme } from "./design/theme";

// Apply the stored preference before first paint to avoid a theme flash.
applyTheme(getTheme());

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
