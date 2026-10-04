import { NextRequest, NextResponse } from "next/server";

const ROBOFLOW_URL = process.env.ROBOFLOW_SERVERLESS_URL || "";
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY || "";

export async function POST(req: NextRequest) {
  if (!ROBOFLOW_URL || !ROBOFLOW_KEY) {
    return NextResponse.json(
      { error: "Roboflow not configured" },
      { status: 500 }
    );
  }

  let body: { imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = body.imageUrl;
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return NextResponse.json(
      { error: "imageUrl must be a public http URL" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(ROBOFLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ROBOFLOW_KEY}`,
      },
      body: JSON.stringify({
        inputs: {
          image: { type: "url", value: imageUrl },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();

    if (!res.ok) {
      console.warn(`[roboflow proxy] ${res.status}: ${text.slice(0, 200)}`);
      return NextResponse.json(
        { error: `Roboflow ${res.status}`, detail: text.slice(0, 500) },
        { status: res.status }
      );
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[roboflow proxy] error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}