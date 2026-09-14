import Link from "next/link";
import Image from "next/image";

// Your logo.png is 800×321 → aspect ratio 2.492
const LOGO_ASPECT = 800 / 321;

export default function Logo({
  height = 48,
  href = "/",
  variant = "default",
}: {
  height?: number;
  href?: string | null;
  variant?: "default" | "light";
}) {
  const width = Math.round(height * LOGO_ASPECT);

  const inner = (
    <span
      className="inline-flex items-center"
      style={{ height, width }}
    >
      <Image
        src="/logo.png"
        alt="KrishiLink"
        width={width}
        height={height}
        priority
        className={`h-full w-full object-contain ${
          variant === "light" ? "brightness-0 invert" : ""
        }`}
      />
    </span>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      aria-label="KrishiLink home"
      className="inline-flex items-center"
    >
      {inner}
    </Link>
  );
}