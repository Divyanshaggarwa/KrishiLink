import { getSessionUser } from "@/lib/auth";
import LiveSyncProvider from "./LiveSyncProvider";

export default async function LiveSyncMount() {
  const user = await getSessionUser();
  return <LiveSyncProvider userId={user?.id} />;
}