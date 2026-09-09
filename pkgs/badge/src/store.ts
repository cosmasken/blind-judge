import fs from "node:fs";
import path from "node:path";

const DATA_FILE = process.env.DATA_FILE ?? "./data/registrations.json";

export type Project = {
  name: string;
  url: string;
  contract: string | null;
};

export type Event = {
  id: string;           // organiser pk hex
  name: string;
  hackathon: string;
  judgeCount: number;
  projects: Project[];
  judges: Record<string, string>; // pubkey -> name (populated after judges join)
};

type Store = {
  events: Record<string, Event>;
  contracts: Record<string, { eventId: string; projectIdx: number }>; // contract addr -> event+project
};

const load = (): Store => {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Store; }
  catch { return { events: {}, contracts: {} }; }
};

const save = (store: Store): void => {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
};

export const getEvent = (id: string): Event | null => load().events[id] ?? null;

export const upsertEvent = (id: string, data: Partial<Event>): Event => {
  const store = load();
  store.events[id] = { id, name: "", hackathon: "", judgeCount: 2, projects: [], judges: {}, ...store.events[id], ...data };
  save(store);
  return store.events[id];
};

export const setProjectContract = (eventId: string, projectIdx: number, contract: string): void => {
  const store = load();
  if (store.events[eventId]) {
    store.events[eventId].projects[projectIdx].contract = contract;
    store.contracts[contract] = { eventId, projectIdx };
  }
  save(store);
};

export const getContractMeta = (contract: string) => load().contracts[contract] ?? null;

export const updateJudgeName = (contract: string, pubkey: string, name: string): void => {
  const store = load();
  const meta = store.contracts[contract];
  if (meta && store.events[meta.eventId]) {
    store.events[meta.eventId].judges[pubkey] = name;
  }
  save(store);
};
