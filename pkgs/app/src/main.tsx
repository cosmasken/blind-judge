import "@/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Toaster } from "./components/ui/sonner";
import { NetworkProvider } from "./contexts/NetworkContext";
import { WalletProvider } from "./contexts/WalletContext";
import "./css/index.css";

/**
 * エントリーポイント。
 * NetworkProvider はウォレット接続前に確定させる必要があるため WalletProvider の外側に置く。
 * WalletProvider でアプリ全体をラップし、ウォレット状態をグローバルに共有する。
 * Toaster はトースト通知の表示レイヤーとして最上位に配置する。
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NetworkProvider>
      <WalletProvider>
        <App />
        <Toaster theme="dark" position="bottom-right" richColors />
      </WalletProvider>
    </NetworkProvider>
  </StrictMode>,
);
