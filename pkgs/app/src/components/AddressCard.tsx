import {
  Check,
  Copy,
  Droplets,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNetwork } from "@/contexts/useNetwork";
import { useWallet } from "@/contexts/useWallet";
import { useBalance } from "@/hooks/useBalance";
import { cn, copyToClipboard, truncateAddress } from "@/lib/utils";
import { CURRENCY_UNIT } from "@/utils/constants";
import { NETWORKS } from "@/utils/networks";
import type { WalletConnectionResult } from "@/utils/types";

/**
 * 接続済みウォレットの詳細情報カード。
 * - シールドアドレス（コピーボタン付き）
 * - Shielded / Unshielded / Dust の残高（手動更新可）
 * - 切断ボタン
 */
function ConnectedCard({ connection }: { connection: WalletConnectionResult }) {
  const { disconnect } = useWallet();
  const { networkId } = useNetwork();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { address } = connection.state;
  const { balanceState, refresh } = useBalance(connection.wallet);

  // マウント時に残高を初回取得
  useEffect(() => {
    refresh();
  }, [refresh]);

  // コピー完了アイコンを 2 秒後に元に戻す
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(id);
  }, [copied]);

  const handleCopy = async () => {
    await copyToClipboard(address);
    setCopied(true);
    toast.success(t("toast.copySuccess"));
  };

  const isRefreshing = balanceState.status === "loading";

  return (
    <Card className="w-full max-w-lg border-border bg-card shadow-[0_0_40px_0_rgba(168,85,247,0.15)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 border-cyan/30 bg-cyan/10 text-cyan"
        >
          <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
          {t("label.connected")}
        </Badge>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs text-primary">
          {NETWORKS[networkId].label}
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {t("label.shieldedAddress")}
          </p>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-4 py-3">
            <code className="flex-1 truncate font-mono text-sm text-foreground">
              {truncateAddress(address)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              aria-label={t("aria.copyAddress")}
            >
              {copied ? (
                <Check className="h-4 w-4 text-cyan" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("label.balance")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={refresh}
              disabled={isRefreshing}
              aria-label={t("aria.refreshBalance")}
            >
              <RefreshCw
                className={cn("h-3 w-3", isRefreshing && "animate-spin")}
              />
              {t("label.refresh")}
            </Button>
          </div>

          {isRefreshing ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("label.loadingBalance")}
            </div>
          ) : balanceState.status === "error" ? (
            <p className="py-2 text-xs text-destructive">
              {t("error.balanceFailed")}
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg bg-muted overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  {t("label.shielded")}
                </div>
                <span className="font-mono text-sm font-semibold text-primary">
                  {balanceState.status === "loaded"
                    ? balanceState.shielded
                    : "--"}{" "}
                  {CURRENCY_UNIT}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  {t("label.unshielded")}
                </div>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {balanceState.status === "loaded"
                    ? balanceState.unshielded
                    : "--"}{" "}
                  {CURRENCY_UNIT}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Droplets className="h-3.5 w-3.5" />
                  {t("label.dust")}
                </div>
                <span className="font-mono text-sm font-semibold text-cyan">
                  {balanceState.status === "loaded" ? balanceState.dust : "--"}{" "}
                  {CURRENCY_UNIT}
                </span>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={disconnect}
        >
          <Unlink className="mr-2 h-4 w-4" />
          {t("label.disconnect")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * ウォレット接続状態のガードラッパー。
 * "connected" 以外の状態では何もレンダリングしない。
 * App.tsx で接続済みの場合にのみ表示される。
 */
export function AddressCard() {
  const { state } = useWallet();
  if (state.status !== "connected") return null;
  return <ConnectedCard connection={state.connection} />;
}
