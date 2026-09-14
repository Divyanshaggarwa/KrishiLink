import Link from "next/link";
import Image from "next/image";

// Your logo.png is 800×321 → aspect ratio ≈ 2.492
const LOGO_ASPECT = 800 / 321;

export default function Logo({
  height = 40,
  href = "/",
  variant = "default",
}: {
  height?: number;
  href?: string | null;
  variant?: "default" | "light";
}) {
  const width = Math.round(height * LOGO_ASPECT);

  const inner = (
    <span className="inline-flex items-center">
      <Image
        src="/logo.png"
        alt="KrishiLink"
        width={width}
        height={height}
        priority
        className={`object-contain ${variant === "light" ? "brightness-0 invert" : ""}`}
        style={{ height, width: "auto" }}
      />
    </span>
  );

  if (!href) return inner;

  return (
    <Link href={href} aria-label="KrishiLink home" className="inline-flex">
      {inner}
    </Link>
  );
}