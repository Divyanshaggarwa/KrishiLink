import FpoTabBar from "@/components/fpo/FpoTabBar";

export default function FpoDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <FpoTabBar />
      {children}
    </div>
  );
}