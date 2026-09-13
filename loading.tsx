import LoadingScreen from "@/components/LoadingScreen";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 h-16 border-b border-[#E4EBE6] bg-white/80 backdrop-blur-md" />
      <LoadingScreen />
    </div>
  );
}