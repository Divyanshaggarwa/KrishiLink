import "server-only";

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function serveRouteAiHtml() {
  try {
    const filePath = join(process.cwd(), "public", "route_ai.html");
    const html = await readFile(filePath, "utf8");
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[route-ai] failed to read public/route_ai.html", error);
    return new NextResponse("Route AI page is unavailable.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
