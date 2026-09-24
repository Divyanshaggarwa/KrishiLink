import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [], unread: 0 });

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const items = data || [];
  const unread = items.filter((i) => !i.is_read).length;
  return NextResponse.json({ items, unread });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = body?.id;

  if (id) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);
  } else {
    // Mark all as read
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}