import { NextRequest, NextResponse } from "next/server";
import { listCommentsByAuthor } from "@/lib/comment-store";
import { getContent } from "@/lib/content-store";
import { parseAddress } from "@/lib/security/validation";

export async function GET(req: NextRequest) {
  const author = parseAddress(req.nextUrl.searchParams.get("author") ?? "");
  if (!author) {
    return NextResponse.json({ error: "author required" }, { status: 400 });
  }

  const comments = await listCommentsByAuthor(author);
  const enriched = await Promise.all(
    comments
      .filter((c) => c.contentId)
      .map(async (c) => {
        const post = await getContent(c.contentId!);
        return {
          ...c,
          postTitle: post?.title || post?.body.slice(0, 80) || "Post",
          postAuthor: post?.authorUsername,
        };
      }),
  );

  return NextResponse.json({ comments: enriched });
}
