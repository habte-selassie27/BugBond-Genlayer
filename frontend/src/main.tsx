import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { AppRoutes } from "@/routes";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root is missing from index.html.");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <WalletProvider>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </WalletProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);