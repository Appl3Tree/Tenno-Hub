import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installVitePreloadRecovery } from "./app/vitePreloadRecovery";
import "./styles.css";

installVitePreloadRecovery();

const rootEl = document.getElementById("root");

if (!rootEl) {
    throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
