import { serve } from "@hono/node-server";
import { Judge } from "contract";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { MIDNIGHT_NETWORK_ENDPOINTS } from "shared";
import { getContractMeta, getEvent, setProjectContract, upsertEvent, updateJudgeName } from "./store.js";

const INDEXER_URL = process.env.INDEXER_URL ?? MIDNIGHT_NETWORK_ENDPOINTS.preview.indexer;
const PORT = Number(process.env.PORT ?? 3001);

const cache = new Map<string, { data: unknown; ts: number }>();
const cached = <T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data as T);
  return fn().then((data) => { cache.set(key, { data, ts: Date.now() }); return data; });
};

const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex");

type LedgerState = {
  state: number;
  judging_over: boolean;
  judge_count: number;
  judges_joined: number;
  judges_committed: number;
  judges_revealed: number;
  score_sum: bigint;
  final_score: number;
  organiser_key: Uint8Array;
  key0: Uint8Array; key1: Uint8Array; key2: Uint8Array; key3: Uint8Array; key4: Uint8Array;
  revealed0: boolean; revealed1: boolean; revealed2: boolean; revealed3: boolean; revealed4: boolean;
};

const fetchContractState = async (address: string): Promise<LedgerState | null> => {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: `{ contract(address: "${address}") { state } }` }),
  });
  const json = await res.json() as { data?: { contract?: { state?: string } } };
  const raw = json.data?.contract?.state;
  if (!raw) return null;
  return Judge.ledger(Buffer.from(raw, "hex")) as unknown as LedgerState;
};

const stateToJson = (address: string, state: LedgerState, judgeNames: Record<string, string>) => {
  const judges = Array.from({ length: state.judge_count }, (_, i) => {
    const key = toHex(state[`key${i}` as keyof typeof state] as Uint8Array);
    return { slot: i, joined: state.judges_joined > i, revealed: state[`revealed${i}` as keyof typeof state] as boolean, key, name: judgeNames[key] ?? null };
  });
  return {
    address,
    state: ["waiting", "committed", "finished", "cancelled"][state.state] ?? "unknown",
    judging_over: state.judging_over,
    judge_count: state.judge_count,
    judges_committed: state.judges_committed,
    judges_revealed: state.judges_revealed,
    judges,
    final_score: state.judging_over ? state.final_score : null,
  };
};

const app = new Hono();
app.use("*", cors());

// GET /state/:address
app.get("/state/:address", async (c) => {
  const { address } = c.req.param();
  const state = await cached(`state:${address}`, 30_000, () => fetchContractState(address));
  if (!state) return c.json({ error: "Contract not found" }, 404);
  const meta = getContractMeta(address);
  const event = meta ? getEvent(meta.eventId) : null;
  return c.json({ ...stateToJson(address, state, event?.judges ?? {}), event: event ? { id: event.id, name: event.name, hackathon: event.hackathon, project: event.projects[meta!.projectIdx] } : null });
});

// GET /badge/:address — Shields.io
app.get("/badge/:address", async (c) => {
  const { address } = c.req.param();
  const state = await cached(`state:${address}`, 30_000, () => fetchContractState(address));
  const meta = getContractMeta(address);
  const event = meta ? getEvent(meta.eventId) : null;
  const project = event && meta ? event.projects[meta.projectIdx] : null;
  const label = project ? `BlindJudge · ${project.name}` : "BlindJudge";

  if (!state) return c.json({ schemaVersion: 1, label, message: "not found", color: "red" });

  let message: string; let color: string;
  if (state.judging_over && state.state === 2) { message = `score: ${state.final_score}/10 ✓`; color = "brightgreen"; }
  else if (state.state === 3) { message = "cancelled"; color = "lightgrey"; }
  else if (state.state === 1) { message = `${state.judges_revealed}/${state.judge_count} revealed`; color = "yellow"; }
  else { message = `${state.judges_committed}/${state.judge_count} committed`; color = state.judges_committed === state.judge_count ? "yellow" : "blue"; }

  return c.json({ schemaVersion: 1, label, message, color });
});

// GET /event/:id — full event with all projects + live state
app.get("/event/:id", async (c) => {
  const event = getEvent(c.req.param("id"));
  if (!event) return c.json({ error: "Event not found" }, 404);

  const projects = await Promise.all(event.projects.map(async (p, i) => {
    if (!p.contract) return { ...p, index: i, contractState: null };
    const state = await cached(`state:${p.contract}`, 30_000, () => fetchContractState(p.contract!));
    return { ...p, index: i, contractState: state ? stateToJson(p.contract, state, event.judges) : null };
  }));

  return c.json({ ...event, projects });
});

// POST /event — organiser creates/updates event
app.post("/event", async (c) => {
  const body = await c.req.json() as { id: string; name?: string; hackathon?: string; judgeCount?: number; projects?: { name: string; url: string }[] };
  if (!body.id) return c.json({ error: "id (organiser pubkey) required" }, 400);
  const event = upsertEvent(body.id, {
    name: body.name,
    hackathon: body.hackathon,
    judgeCount: body.judgeCount,
    projects: body.projects?.map(p => ({ ...p, contract: null })),
  });
  return c.json({ ok: true, event });
});

// POST /event/:id/project/:idx/contract — link deployed contract to project
app.post("/event/:id/project/:idx/contract", async (c) => {
  const { id, idx } = c.req.param();
  const { contract } = await c.req.json() as { contract: string };
  if (!contract) return c.json({ error: "contract required" }, 400);
  setProjectContract(id, Number(idx), contract);
  return c.json({ ok: true });
});

// POST /event/:id/judge — record judge name after they join
app.post("/event/:id/judge", async (c) => {
  const { id } = c.req.param();
  const { contract, pubkey, name } = await c.req.json() as { contract: string; pubkey: string; name: string };
  updateJudgeName(contract, pubkey, name);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: PORT }, () => console.log(`Badge server :${PORT}`));
