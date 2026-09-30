import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "driver.js/dist/driver.css";
import "./styles.css";
import App from "./App";
import { AccountProvider } from "./context/Account";
import { PlayerProvider } from "./context/Player";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AccountProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </AccountProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
