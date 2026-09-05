import { createContext } from "react";
import type { NetworkId } from "@/utils/networks";

export interface NetworkContextValue {
  networkId: NetworkId;
  setNetworkId: (id: NetworkId) => void;
}

// null をデフォルト値にし、Provider 外での誤用を useNetwork() の guard で検出する
export const NetworkContext = createContext<NetworkContextValue | null>(null);
