# BlindJudge

[![BlindJudge](https://img.shields.io/endpoint?url=https://zk.ussd.cash/badge/1024410d2e7c74fd0224bd22b23fa089d3bcf4bb9ce5a42156faac4871ee2b66)](https://zk.ussd.cash)

> Tamper-proof, bias-free hackathon judging on Midnight.

BlindJudge is a privacy-first judging platform built on the [Midnight Network](https://midnight.network). Judges score projects independently using a ZK commit/reveal scheme — no one can see another judge's score until all scores are locked in. The final result is publicly verifiable on-chain.

## The Problem

Hackathon judging is broken:
- Judges anchor on each other's scores (groupthink)
- Teams claim their projects were never reviewed — no proof either way
- Reputation bias: well-known teams score higher before a line of code is read
- No audit trail — organizers can adjust scores after the fact

## How BlindJudge Fixes It

1. **Judge commits a score** — score is a ZK witness, never visible on-chain
2. **All judges must commit before anyone reveals** — no anchoring possible
3. **Reveal phase** — each judge reveals; contract verifies commitment matches
4. **Aggregate published** — final scores are on-chain, immutable, auditable
5. **Proof of participation** — the ledger proves every judge submitted a score

## Architecture

| Package | Role |
|---|---|
| `pkgs/contract` | Compact smart contract (`src/judge.compact`) — commit/reveal/aggregate |
| `pkgs/shared` | Shared types, network config, constants |
| `pkgs/cli` | Node.js CLI — deploy contract, submit scores headlessly |
| `pkgs/app` | React + Vite browser UI — judge dashboard + results view |

## Quick Start

### Prerequisites

- Docker
- Bun >= 1.2.0
- `compactc 0.30.0` (see below)
- Lace Wallet browser extension → https://www.lace.io/

### Install compactc

```bash
compact update 0.30.0
compact list  # verify 0.30.0 is active
```

### Install dependencies

```bash
bun install
```

### Compile contract + build all packages

```bash
bun contract compact
bun run build
```

### Get testnet tokens

Preview faucet (faster sync): https://faucet.preview.midnight.network/

### Deploy

See [DEPLOY.md](./DEPLOY.md) for full deployment instructions.

### Run frontend

```bash
bun app dev
```

Open two browsers with Lace Wallet connected, paste the deployed contract address, and start judging.

## Live Contract

Network: **Preview testnet**
Contract address:
```
1024410d2e7c74fd0224bd22b23fa089d3bcf4bb9ce5a42156faac4871ee2b66
```

## Deployment

Live at **https://zk.ussd.cash** — frontend + proof server on VPS behind Traefik.

### Local dev
```bash
bun install
bun contract compact
bun run build
docker compose -f pkgs/cli/proof-server.yml up   # proof server
bun cli preview                                   # deploy contract, sync wallet
bun app dev                                       # frontend at localhost:5173
```

## License

Apache-2.0
