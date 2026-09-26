import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "./fonts/inter-v20-latin-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/inter-v20-latin-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/inter-v20-latin-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const manrope = localFont({
  src: [
    {
      path: "./fonts/manrope-v20-latin-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/manrope-v20-latin-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/manrope-v20-latin-800.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KrishiLink — Maximize Farmer Net Realization",
  description:
    "KrishiLink is an open agricultural marketplace that maximizes the farmer's net realization: selling price minus logistics and transaction costs.",
};

export const viewport: Viewport = {
  themeColor: "#1B4D3E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}