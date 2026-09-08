import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/contexts/useNetwork";
import { cn } from "@/lib/utils";
import { NETWORK_IDS, NETWORKS } from "@/utils/networks";

/**
 * 接続前に preprod / preview のどちらに接続するかを選ぶセグメントコントロール。
 * 選択は NetworkContext 経由で localStorage に永続化される。
 */
export function NetworkToggle() {
  const { networkId, setNetworkId } = useNetwork();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {t("label.selectNetwork")}
      </span>
      <div className="inline-flex rounded-lg border border-border bg-muted p-1">
        {NETWORK_IDS.map((id) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setNetworkId(id)}
            aria-pressed={networkId === id}
            className={cn(
              "px-3 text-xs",
              networkId === id
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {NETWORKS[id].label}
          </Button>
        ))}
      </div>
    </div>
  );
}
