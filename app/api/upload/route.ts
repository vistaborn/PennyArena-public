import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { isVercelServerless } from "@/lib/data-dir";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

const MAX_SIZE_LOCAL = 8 * 1024 * 1024;
const MAX_SIZE_VERCEL = 3 * 1024 * 1024;
const DATA_URL_MAX = 2 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mpeg: "audio/mpeg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
]);

function guessMime(file: File): string {
  if (file.type && ALLOWED.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const address = parseAddress(form.get("address"));
    if (!address) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }
    const authErr = await requireWalletAuth(req, address);
    if (authErr) return authErr;

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const mime = guessMime(file);
    if (!mime || !ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const onVercel = isVercelServerless();
    const maxSize = onVercel ? MAX_SIZE_VERCEL : MAX_SIZE_LOCAL;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: onVercel ? "File too large (max 3MB on cloud)" : "File too large (max 8MB)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (onVercel) {
      if (!mime.startsWith("image/")) {
        return NextResponse.json(
          {
            error:
              "On the deployed app only images can be uploaded. Add video/audio as a link in the post text.",
          },
          { status: 400 },
        );
      }
      if (file.size > DATA_URL_MAX) {
        return NextResponse.json({ error: "Image too large (max 2MB on cloud)" }, { status: 400 });
      }
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      return NextResponse.json({ url: dataUrl });
    }

    const ext = file.name.split(".").pop()?.slice(0, 8) ?? "bin";
    const id = randomUUID();
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${id}.${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}
