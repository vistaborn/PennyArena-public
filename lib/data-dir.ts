import os from "os";
import path from "path";

export function getDataDir(): string {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "penny-arena");
  }
  return path.join(process.cwd(), "data");
}

export function isVercelServerless(): boolean {
  return process.env.VERCEL === "1";
}
