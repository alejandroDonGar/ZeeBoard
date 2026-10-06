import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, getTheme } from "./lib/theme";

// Before first paint, to avoid a flash of the wrong theme
applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
