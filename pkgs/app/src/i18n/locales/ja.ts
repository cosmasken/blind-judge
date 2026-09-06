const ja = {
  error: {
    walletNotFound:
      "Midnight Lace Wallet が見つかりません。拡張機能をインストールしてください。",
    versionMismatch:
      "Lace Wallet のバージョン ({{version}}) が古いです。最新版に更新してください。",
    networkMismatch:
      "ネットワークが一致しません。Lace Settings で {{network}} を選択してください。",
    userRejected: "ウォレット接続がキャンセルされました。",
    walletTimeout:
      "接続タイムアウト。Lace Wallet のロックを解除してから再試行してください。",
    walletSyncing:
      "Lace Wallet がネットワークと同期中です。Lace拡張機能を開いて同期が完了するのを待ってから、再度お試しください。",
    unsupportedApi:
      "Unsupported Lace Wallet API: neither connect() nor enable() found.",
    connectGeneric: "接続中にエラーが発生しました。再度お試しください。",
    useWalletOutsideProvider: "useWallet must be used inside WalletProvider",
    connectFailed: "接続に失敗しました。上のボタンで再試行してください。",
    balanceFailed: "残高の取得に失敗しました",
  },
  label: {
    connected: "Connected",
    shieldedAddress: "シールドアドレス",
    balance: "残高",
    refresh: "更新",
    disconnect: "切断する",
    loadingBalance: "残高を取得中...",
    shielded: "Shielded",
    unshielded: "Unshielded",
    dust: "Dust",
    selectNetwork: "ネットワークを選択",
  },
  aria: {
    copyAddress: "アドレスをコピー",
    refreshBalance: "残高を更新",
    midnightLogo: "Midnight",
  },
  button: {
    connect: "Connect Lace Wallet",
    connecting: "接続中...",
    disconnect: "切断する",
  },
  app: {
    subtitle: "Lace Wallet を接続して Midnight Network にアクセスしてください",
  },
  toast: {
    copySuccess: "アドレスをコピーしました",
  },
  rps: {
    title: "RPS ゲーム（グー・チョキ・パー）",
    contractAddress: "コントラクトアドレス",
    addressPlaceholder: "デプロイ済みコントラクトアドレスを入力...",
    join: "参加する",
    joining: "参加中...",
    error: "エラー",
    moves: {
      rock: "グー",
      paper: "パー",
      scissors: "チョキ",
    },
    commit: {
      button: "コミット",
      loading: "ZK証明生成中...",
    },
    reveal: {
      button: "リビール",
      loading: "ZK証明生成中...",
    },
    waiting: {
      forOpponentCommit: "相手のコミット待機中...",
      readyToReveal: "両者コミット済み。リビール可能！",
      bothCommitted: "両者が手をコミットしました",
      forOpponentReveal: "相手のリビール待機中...",
    },
    phase: {
      select: "選択",
      commit: "コミット",
      reveal: "リビール",
      result: "結果",
    },
    sealed: {
      title: "あなたの手はシールド済み",
      zkSealed: "ZKシール済み · コミットメントをオンチェーンに記録",
    },
    opponent: {
      label: "相手",
      waiting: "コミット待機中...",
      committed: "コミット済み",
    },
    toast: {
      commitOk: "コミット成功！",
      revealOk: "リビール成功！",
    },
    result: {
      win: "あなたの勝利！🎉",
      lose: "あなたの負け",
      draw: "引き分け！🤝",
      yourMove: "あなたの手",
      opponentMove: "相手の手",
      winner: "勝利！",
      playAgain: "もう一度プレイ",
    },
  },
} as const;

export default ja;
