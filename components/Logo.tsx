import Link from "next/link";

export default function Logo({
  size = 36,
  showText = true,
  href = "/",
  variant = "default",
}: {
  size?: number;
  showText?: boolean;
  href?: string | null;
  variant?: "default" | "light";
}) {
  const inner = (
    <span className="flex items-center gap-2.5">
      <img src="/logo.png" alt="KrishiLink" width={size} height={size} className="shrink-0 object-contain" />

      {showText && (
        <span
          className={`font-display text-xl font-bold tracking-tight ${
            variant === "light" ? "text-white" : "text-[#0F1F1A]"
          }`}
        >
          KrishiLink
        </span>
      )}
    </span>
  );

  if (!href) return inner;

  return (
    <Link href={href} aria-label="KrishiLink home" className="inline-flex">
      {inner}
    </Link>
  );
}