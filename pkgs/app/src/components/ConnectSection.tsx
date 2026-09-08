import { Loader2, Scale, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/useWallet";

export function ConnectSection() {
  const { state, connect } = useWallet();
  const isConnecting = state.status === "connecting";

  return (
    <div className="flex flex-col items-center gap-8 px-4 text-center max-w-lg">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full bg-cyan-500/20 blur-2xl" />
          <Scale className="relative h-12 w-12 text-cyan-400" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">BlindJudge</h1>
        <p className="text-base text-white/50 max-w-sm">
          Tamper-proof, bias-free hackathon judging on Midnight. Judges score privately — no one sees another's score until all are locked in.
        </p>
      </div>

      {/* How it works */}
      <div className="w-full grid grid-cols-1 gap-3 text-left">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex gap-3">
          <Shield className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">For Judges</p>
            <p className="text-xs text-white/50 mt-0.5">Open your invite link → connect Lace wallet → pick a project → score it (1–10) → commit → reveal when all judges are ready. Your score is ZK-sealed until reveal.</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex gap-3">
          <Users className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">For Organisers</p>
            <p className="text-xs text-white/50 mt-0.5">Go to <a href="/setup" className="text-cyan-400 hover:underline">/setup</a> → enter your event name, hackathon URL, and project list → deploy one contract per project → share judge invite links. Final scores are on-chain and publicly verifiable.</p>
          </div>
        </div>
      </div>

      {/* Connect */}
      <div className="flex flex-col items-center gap-3 w-full">
        <Button
          size="lg"
          onClick={connect}
          disabled={isConnecting}
          className="min-w-52 bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-70"
        >
          {isConnecting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
          ) : (
            "Connect Lace Wallet"
          )}
        </Button>
        <p className="text-xs text-white/30">Requires <a href="https://www.lace.io/" target="_blank" rel="noreferrer" className="text-cyan-400/70 hover:text-cyan-400">Lace Wallet</a> browser extension on Midnight Preview testnet</p>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-400">Connection failed. Make sure Lace Wallet is installed and unlocked.</p>
      )}
    </div>
  );
}
