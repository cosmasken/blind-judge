# Midnight dApp — フロントエンド

Midnight Network (PreProd) に接続するサンプル dApp のフロントエンドです。  
Lace Wallet を使ってウォレット接続・シールドアドレス表示・残高確認ができます。

## 機能概要

| 機能 | 説明 |
|---|---|
| Lace Wallet 接続 | `window.midnight.mnLace` を 100ms ポーリングで検出し接続 |
| バージョン検証 | Connector API バージョンが `>=1.0.0` か確認 |
| ネットワーク検証 | PreProd / mainnet / undeployed / preview の順に自動試行 |
| アドレス表示 | シールドアドレスをコピー可能な形式で表示 |
| 残高表示 | Shielded / Unshielded / Dust の 3 種を tDUST 単位で表示 |
| 言語切り替え | 右上ボタンで日本語 ⇆ English を即時切り替え（localStorage 永続化） |

## 技術スタック

| カテゴリ | ライブラリ / ツール |
|---|---|
| フレームワーク | React 19 + TypeScript |
| ビルド | Vite 8 |
| スタイリング | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI コンポーネント | shadcn/ui (Button, Badge, Card) + Lucide React |
| 国際化 | i18next 26 + react-i18next 17 |
| ウォレット連携 | `@midnight-ntwrk/dapp-connector-api` |
| 非同期処理 | RxJS 7 |
| パッケージマネージャー | Bun |
| フォーマッター | Biome |

## ディレクトリ構成

```
src/
├── App.tsx                     # ルートコンポーネント（接続状態で画面切替）
├── main.tsx                    # エントリーポイント
├── components/
│   ├── ConnectSection.tsx      # 未接続時のランディング画面
│   ├── AddressCard.tsx         # 接続後のウォレット情報カード
│   ├── LanguageToggle.tsx      # 右上固定の言語切り替えボタン
│   └── ui/                    # shadcn/ui 基本コンポーネント
├── contexts/
│   ├── WalletContext.tsx       # ウォレット状態管理プロバイダー
│   ├── walletContextDef.ts    # Context 型定義
│   └── useWallet.ts           # useWallet フック
├── hooks/
│   └── useBalance.ts          # 残高取得フック
├── i18n/
│   ├── index.ts               # i18next 初期化（デフォルト: 日本語）
│   └── locales/
│       ├── ja.ts              # 日本語翻訳
│       └── en.ts              # 英語翻訳
├── lib/
│   ├── wallet.ts              # Lace 接続ロジック・エラークラス群
│   └── utils.ts               # Tailwind クラス結合ユーティリティ
└── utils/
    ├── constants.ts           # ネットワーク設定・通貨単位等の定数
    └── types.ts               # 共通型定義
```

## セットアップ

```bash
bun install
bun run dev      # 開発サーバー起動 (http://localhost:5173)
bun run build    # 本番ビルド → dist/
bun run preview  # dist/ をローカルプレビュー
bun run lint     # ESLint 実行
bun run format   # Biome フォーマット
```

## 前提条件

- [Lace Wallet](https://www.lace.io/) ブラウザ拡張機能（Midnight 対応版）をインストール済みであること
- Lace の設定で **PreProd** ネットワークが選択されていること
- ZK 証明が必要な操作を行う場合は Proof Server（ポート 6300）を起動すること

```bash
# プロジェクトルートから Midnight ローカルインフラを起動する場合
docker compose -f standalone.yml up -d
```

## 環境変数

現在、必須の環境変数はありません。  
Indexer / Node の URI は Lace Wallet から自動取得し、取得できない場合は `src/utils/constants.ts` の `FALLBACK_URIS`（testnet-02）にフォールバックします。

## コントラクトのアドレス

PreProdにデプロイしたコントラクトアドレス

```bash
[15:58:30.712] INFO (37564): Deploying counter contract...
  ⠋ Deploying counter contract[15:58:51.164] INFO (37564): Deployed contract at address: 64c73de16b1054f970e4decaa3372b99771a67c73c27d91cfd0aee35512349bf
  ✓ Deploying counter contract
  Contract deployed at: 64c73de16b1054f970e4decaa3372b99771a67c73c27d91cfd0aee35512349bf
```

ネットワークプレフィックスを入れる必要あり

```bash
020064c73de16b1054f970e4decaa3372b99771a67c73c27d91cfd0aee35512349bf
```