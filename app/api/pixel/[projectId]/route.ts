import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildPixelJs, isValidProjectId } from "@/lib/pixel";
import { pixelProjectExists } from "@/lib/attribution";

/**
 * The hosted attribution pixel: a tiny classic script the user includes with
 * one line — `<script async src=".../api/pixel/{projectId}"></script>`.
 * Serving it (instead of an inline paste) keeps setup copy-paste simple and
 * lets the script evolve without users re-pasting. Cached for an hour; no
 * CORS needed (classic <script src> loads are exempt).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  if (!isValidProjectId(projectId) || !(await pixelProjectExists(projectId))) {
    return new NextResponse("/* unknown pixel */", {
      status: 404,
      headers: { "Content-Type": "text/javascript; charset=utf-8" },
    });
  }

  return new NextResponse(buildPixelJs(env.APP_URL, projectId), {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
