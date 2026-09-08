import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Plus, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/useWallet";
import { useNetwork } from "@/contexts/useNetwork";
import { createJudgeProviders } from "@/lib/providers";
import { deployJudgeContract, getMyPublicKeyHex } from "@/lib/judge";
import { fromHex } from "@midnight-ntwrk/midnight-js-utils";

type Project = { name: string; url: string; contract: string | null };
type DeployStatus = "idle" | "deploying" | "done" | "error";

const BADGE_BASE = `${window.location.origin}/badge`;
const EVENT_API = `${window.location.origin}/badge/event`;

const inputCls = "w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 font-mono";
const labelCls = "block text-xs font-medium text-white/50 uppercase tracking-wider mb-1";

export function Setup() {
  const { state } = useWallet();
  const { networkId } = useNetwork();

  const [eventName, setEventName] = useState("");
  const [hackathon, setHackathon] = useState("");
  const [judgeCount, setJudgeCount] = useState(3);
  const [projects, setProjects] = useState<Project[]>([{ name: "", url: "", contract: null }]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const connection = state.status === "connected" ? state.connection : null;

  const addProject = () => setProjects(p => [...p, { name: "", url: "", contract: null }]);
  const removeProject = (i: number) => setProjects(p => p.filter((_, idx) => idx !== i));
  const updateProject = (i: number, field: keyof Project, val: string) =>
    setProjects(p => p.map((proj, idx) => idx === i ? { ...proj, [field]: val } : proj));

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const deploy = async () => {
    if (!connection) return;
    setDeployStatus("deploying");
    setDeployLog([]);

    try {
      const providers = createJudgeProviders(connection, networkId);
      const organiserPkHex = await getMyPublicKeyHex(providers);
      const organiserPk = fromHex(organiserPkHex);
      setEventId(organiserPkHex);

      // register event on badge server
      await fetch(`${EVENT_API}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: organiserPkHex, name: eventName, hackathon, judgeCount, projects: projects.map(p => ({ name: p.name, url: p.url })) }),
      });

      const deployed: Project[] = [];
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        setDeployLog(l => [...l, `Deploying contract for "${p.name}"...`]);
        const contract = await deployJudgeContract(providers, organiserPk, judgeCount);
        // biome-ignore lint/suspicious/noExplicitAny: contract address accessor
        const address = (contract as any).deployTxData?.public?.contractAddress ?? (contract as any).contractAddress;
        deployed.push({ ...p, contract: address });

        // link contract to project on badge server
        await fetch(`${EVENT_API}/${organiserPkHex}/project/${i}/contract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contract: address }),
        });
        setDeployLog(l => [...l, `✓ "${p.name}" → ${String(address).slice(0, 16)}...`]);
      }

      setProjects(deployed);
      setDeployStatus("done");
    } catch (e) {
      setDeployLog(l => [...l, `✗ ${e instanceof Error ? e.message : String(e)}`]);
      setDeployStatus("error");
    }
  };

  const judgeLink = (name: string) => `${window.location.origin}?event=${eventId}&judge=${encodeURIComponent(name)}`;
  const badgeMd = (p: Project) => p.contract ? `[![BlindJudge](https://img.shields.io/endpoint?url=${BADGE_BASE}/${p.contract})](${window.location.origin}?event=${eventId})` : "";

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-10">
      <Card className="w-full max-w-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80 uppercase tracking-wider">
            <Scale className="h-4 w-4 text-cyan-400" />
            BlindJudge — Organiser Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!connection && (
            <p className="text-sm text-yellow-400/80">Connect your Lace wallet first to deploy contracts.</p>
          )}

          {/* Event details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Event Name</label>
              <input className={inputCls} value={eventName} onChange={e => setEventName(e.target.value)} placeholder="ETH Tokyo 2025" />
            </div>
            <div>
              <label className={labelCls}>Judges per Project</label>
              <input className={inputCls} type="number" min={2} max={5} value={judgeCount} onChange={e => setJudgeCount(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Hackathon URL</label>
            <input className={inputCls} value={hackathon} onChange={e => setHackathon(e.target.value)} placeholder="https://akindo.io/..." />
          </div>

          {/* Projects */}
          <div className="space-y-2">
            <label className={labelCls}>Projects</label>
            {projects.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input className={inputCls} value={p.name} onChange={e => updateProject(i, "name", e.target.value)} placeholder="Project name" />
                  <input className={inputCls} value={p.url} onChange={e => updateProject(i, "url", e.target.value)} placeholder="https://akindo.io/project/..." />
                </div>
                {projects.length > 1 && (
                  <Button size="sm" variant="outline" onClick={() => removeProject(i)} className="shrink-0 border-white/15 bg-white/5 text-white/50 hover:text-red-400 hover:bg-white/10 mt-0.5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addProject} className="border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Project
            </Button>
          </div>

          {/* Deploy */}
          {deployStatus !== "done" && (
            <Button onClick={() => void deploy()} disabled={!connection || deployStatus === "deploying" || !eventName || projects.some(p => !p.name)}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
              {deployStatus === "deploying" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deploying {projects.length} contract{projects.length > 1 ? "s" : ""}...</> : `Deploy ${projects.length} Contract${projects.length > 1 ? "s" : ""}`}
            </Button>
          )}

          {/* Deploy log */}
          {deployLog.length > 0 && (
            <div className="rounded-lg bg-black/30 border border-white/10 p-3 space-y-1">
              {deployLog.map((l, i) => <p key={i} className="text-xs font-mono text-white/60">{l}</p>)}
            </div>
          )}

          {/* Results */}
          {deployStatus === "done" && eventId && (
            <div className="space-y-4 pt-2 border-t border-white/10">
              <p className="text-xs text-white/40 uppercase tracking-wider">Share with judges</p>

              {/* Judge invite links */}
              {["Judge 1", "Judge 2", "Judge 3"].slice(0, judgeCount).map((name, i) => (
                <div key={i}>
                  <label className={labelCls}>{name} invite link</label>
                  <div className="flex gap-2">
                    <input readOnly className={`${inputCls} flex-1 min-w-0`} value={judgeLink(name)} />
                    <Button size="sm" variant="outline" onClick={() => copy(judgeLink(name), `judge-${i}`)} className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10">
                      {copied === `judge-${i}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}

              {/* Per-project badges */}
              <div>
                <label className={labelCls}>README badges (one per project)</label>
                <div className="space-y-2">
                  {projects.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input readOnly className={`${inputCls} flex-1 min-w-0 text-xs`} value={badgeMd(p)} />
                      <Button size="sm" variant="outline" onClick={() => copy(badgeMd(p), `badge-${i}`)} className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10">
                        {copied === `badge-${i}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event link */}
              <div>
                <label className={labelCls}>Event dashboard link</label>
                <div className="flex gap-2">
                  <input readOnly className={`${inputCls} flex-1 min-w-0`} value={`${window.location.origin}?event=${eventId}`} />
                  <Button size="sm" variant="outline" onClick={() => copy(`${window.location.origin}?event=${eventId}`, "event")} className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10">
                    {copied === "event" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
