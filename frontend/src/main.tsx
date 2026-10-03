import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { AppRoutes } from "@/routes";
import { warmChain } from "@/lib/scope-data";

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

// Prime the ledger reads while the first paint is still idle: the first
// StudioNet call otherwise pays DNS/TLS (~5s) on the user's click.
warmChain();