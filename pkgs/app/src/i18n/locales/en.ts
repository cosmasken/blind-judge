const en = {
  error: {
    walletNotFound:
      "Midnight Lace Wallet not found. Please install the extension.",
    versionMismatch:
      "Lace Wallet version ({{version}}) is outdated. Please update to the latest version.",
    networkMismatch:
      "Network mismatch. Please select {{network}} in Lace Settings.",
    userRejected: "Wallet connection was cancelled.",
    walletTimeout:
      "Connection timed out. Please unlock Lace Wallet and try again.",
    walletSyncing:
      "Lace Wallet is still syncing with the network. Please open the Lace extension, wait for sync to finish, then try again.",
    unsupportedApi:
      "Unsupported Lace Wallet API: neither connect() nor enable() found.",
    connectGeneric: "An error occurred during connection. Please try again.",
    useWalletOutsideProvider: "useWallet must be used inside WalletProvider",
    connectFailed: "Connection failed. Please retry with the button above.",
    balanceFailed: "Failed to retrieve balance",
  },
  label: {
    connected: "Connected",
    shieldedAddress: "Shielded Address",
    balance: "Balance",
    refresh: "Refresh",
    disconnect: "Disconnect",
    loadingBalance: "Fetching balance...",
    shielded: "Shielded",
    unshielded: "Unshielded",
    dust: "Dust",
    selectNetwork: "Select Network",
  },
  aria: {
    copyAddress: "Copy address",
    refreshBalance: "Refresh balance",
    midnightLogo: "Midnight",
  },
  button: {
    connect: "Connect Lace Wallet",
    connecting: "Connecting...",
    disconnect: "Disconnect",
  },
  app: {
    subtitle: "Tamper-proof, bias-free hackathon judging on Midnight",
  },
  toast: {
    copySuccess: "Address copied to clipboard",
  },
} as const;

export default en;
