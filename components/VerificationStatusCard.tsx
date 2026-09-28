import Link from "next/link";

type Props = {
  profile: {
    verification_status: "pending" | "verified" | "rejected" | null;
    verification_submitted_at: string | null;
    verification_reviewed_at: string | null;
    verification_notes: string | null;
  };
  role: string;
};

const ROLE_FIELDS: Record<string, string> = {
  farmer: "KrishiLink ID, phone, and location details",
  buyer: "Business name, GST, and verified address",
  pds_operator: "PDS Centre ID and operator credentials",
  admin: "Administrator credentials",
};

export default function VerificationStatusCard({ profile, role }: Props) {
  const status = profile.verification_status ?? "pending";

  const config = {
    pending: {
      bg: "border-[#FFE082] bg-[#FFF8E1]",
      dot: "bg-[#B26A00]",
      label: "Under review",
      sub: "KrishiLink admin will verify your account shortly.",
      icon: "⏳",
      accent: "text-[#B26A00]",
    },
    verified: {
      bg: "border-[#A5D6A7] bg-[#EAF5EE]",
      dot: "bg-[#2E7D32]",
      label: "Verified account",
      sub: "Your account is fully verified on the KrishiLink ecosystem.",
      icon: "✓",
      accent: "text-[#2E7D32]",
    },
    rejected: {
      bg: "border-[#FFCDD2] bg-[#FFF5F5]",
      dot: "bg-[#C62828]",
      label: "Verification rejected",
      sub: "Please review the reason below and contact support or reapply.",
      icon: "✕",
      accent: "text-[#C62828]",
    },
  }[status];

  return (
    <section className={`mt-6 overflow-hidden rounded-[24px] border ${config.bg}`}>
      <div className="flex flex-wrap items-start gap-4 p-5 md:p-6">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl ${config.accent}`}
        >
          {config.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-[11px] font-semibold uppercase tracking-widest ${config.accent}`}
            >
              Account verification
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold ${config.accent}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
              {status}
            </span>
          </div>

          <h3 className="font-display mt-2 text-lg font-bold text-[#0F1F1A]">
            {config.label}
          </h3>
          <p className="mt-1 text-sm text-[#0F1F1A]/75">{config.sub}</p>

          {/* Timeline */}
          <div className="mt-4 grid gap-3 text-[11px] text-[#6B7A74] md:grid-cols-2">
            {profile.verification_submitted_at && (
              <div>
                <span className="font-medium text-[#0F1F1A]">Submitted:</span>{" "}
                {new Date(profile.verification_submitted_at).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" }
                )}
              </div>
            )}
            {profile.verification_reviewed_at && (
              <div>
                <span className="font-medium text-[#0F1F1A]">Reviewed:</span>{" "}
                {new Date(profile.verification_reviewed_at).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" }
                )}
              </div>
            )}
          </div>

          {/* Rejection reason */}
          {status === "rejected" && profile.verification_notes && (
            <div className="mt-4 rounded-xl border border-[#FFCDD2] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C62828]">
                Reason
              </p>
              <p className="mt-1 text-xs text-[#0F1F1A]">
                {profile.verification_notes}
              </p>
            </div>
          )}

          {/* Pending — what to expect */}
          {status === "pending" && (
            <div className="mt-4 rounded-xl border border-white/60 bg-white/60 p-3 text-[11px] text-[#B26A00]">
              <strong>Verified fields:</strong>{" "}
              {ROLE_FIELDS[role] ?? "Profile details"}
            </div>
          )}

          {/* Rejected — help */}
          {status === "rejected" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-full bg-[#C62828] px-4 py-2 text-xs font-semibold text-white"
              >
                Contact support
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}