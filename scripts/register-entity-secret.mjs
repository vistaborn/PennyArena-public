/**
 * One-time Circle entity setup — see Corridor Pay / PennyArena README
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...process.env, ...loadEnvFile(envPath) };
const apiKey = env.CIRCLE_API_KEY;

if (!apiKey) {
  console.error("\nMissing CIRCLE_API_KEY in .env.local\n");
  process.exit(1);
}

if (/^CIRCLE_ENTITY_SECRET=/m.test(fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "")) {
  console.log("CIRCLE_ENTITY_SECRET already in .env.local");
  process.exit(0);
}

const entitySecretHex = crypto.randomBytes(32).toString("hex");
const entitySecretBytes = Buffer.from(entitySecretHex, "hex");

const pubRes = await fetch("https://api.circle.com/v1/w3s/config/entity/publicKey", {
  headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
});
if (!pubRes.ok) {
  console.error("Failed to fetch public key:", await pubRes.text());
  process.exit(1);
}
const { data } = await pubRes.json();
const publicKey = crypto.createPublicKey(data.publicKey);
const ciphertext = crypto
  .publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    entitySecretBytes,
  )
  .toString("base64");

const regRes = await fetch("https://api.circle.com/v1/w3s/config/entity/entitySecret", {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ entitySecretCiphertext: ciphertext }),
});
if (!regRes.ok) {
  const text = await regRes.text();
  if (text.includes("156015")) {
    console.log("\nEntity secret already registered in Circle Console — skip this step.");
    console.log("Set Passkey Domain = localhost, then: npm run dev → Register passkey\n");
    process.exit(0);
  }
  console.error("Failed to register:", text);
  process.exit(1);
}

fs.mkdirSync(path.join(root, "recovery"), { recursive: true });
fs.writeFileSync(path.join(root, "recovery", "entity-secret.txt"), `${entitySecretHex}\n`, {
  mode: 0o600,
});
const line = `CIRCLE_ENTITY_SECRET=${entitySecretHex}\n`;
fs.existsSync(envPath) ? fs.appendFileSync(envPath, line) : fs.writeFileSync(envPath, line);
console.log("Entity secret registered. Restart npm run dev.");
