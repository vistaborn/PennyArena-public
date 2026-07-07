import { promises as fs } from "fs";
import path from "path";
import { getDataDir } from "@/lib/data-dir";
import {
  hasSharedStore,
  readSharedUsedTx,
  writeSharedUsedTx,
} from "@/lib/shared-store";

const MEMORY_KEY = "__penny_used_tx__";

type UsedTxStore = Record<string, string>;

function memoryStore(): UsedTxStore {
  const g = globalThis as { [MEMORY_KEY]?: UsedTxStore };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = {};
  return g[MEMORY_KEY]!;
}

function usedTxFile() {
  return path.join(getDataDir(), "used-txs.json");
}

async function readStore(): Promise<UsedTxStore> {
  if (hasSharedStore()) {
    return (await readSharedUsedTx()) ?? {};
  }
  try {
    const raw = await fs.readFile(usedTxFile(), "utf8");
    const parsed = JSON.parse(raw) as UsedTxStore;
    Object.assign(memoryStore(), parsed);
    return parsed;
  } catch {
    return memoryStore();
  }
}

async function writeStore(store: UsedTxStore): Promise<void> {
  Object.assign(memoryStore(), store);
  if (hasSharedStore()) {
    await writeSharedUsedTx(store);
    return;
  }
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    await fs.writeFile(usedTxFile(), JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* memory fallback */
  }
}

export async function isTxHashUsed(txHash: string): Promise<boolean> {
  const store = await readStore();
  return Boolean(store[txHash.toLowerCase()]);
}

export async function claimTxHash(txHash: string, purpose: string): Promise<boolean> {
  const key = txHash.toLowerCase();
  const store = await readStore();
  if (store[key]) return false;
  store[key] = purpose;
  await writeStore(store);
  return true;
}
