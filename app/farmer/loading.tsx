import LoadingScreen from "@/components/LoadingScreen";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="sticky top-0 h-16 border-b border-[#E4EBE6] bg-white/80 backdrop-blur-md" />
      <LoadingScreen message="Loading your farm dashboard…" />
    </div>
  );
}