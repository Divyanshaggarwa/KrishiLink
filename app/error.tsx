"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-6 py-12">
      <div className="w-full max-w-lg rounded-[24px] border border-[#FFCDD2] bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF5F5] text-3xl">
          ⚠️
        </div>
        <h1 className="font-display mt-5 text-2xl font-extrabold text-[#1B4D3E]">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-[#6B7A74]">
          We hit an unexpected error. Your data is safe. Try reloading the page
          or contact support if the issue persists.
        </p>

        {error.digest && (
          <p className="mt-3 rounded-lg bg-[#F8F9FA] p-2 font-mono text-[11px] text-[#6B7A74]">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-[#E4EBE6] px-6 py-3 text-sm font-medium text-[#6B7A74] transition-colors hover:border-[#1B4D3E] hover:text-[#1B4D3E]"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}