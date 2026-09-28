import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-6 py-12">
      <div className="w-full max-w-lg rounded-[24px] border border-[#E4EBE6] bg-white p-8 text-center">
        <p className="font-display text-6xl font-extrabold text-[#A5D6A7]">
          404
        </p>
        <h1 className="font-display mt-4 text-2xl font-extrabold text-[#1B4D3E]">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-[#6B7A74]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}