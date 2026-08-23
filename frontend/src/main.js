import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { html } from "./html.js";
import App from "./app.js";

createRoot(document.getElementById("root")).render(html`<${StrictMode}><${App} /><//>`);
