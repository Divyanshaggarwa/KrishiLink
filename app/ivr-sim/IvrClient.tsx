"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  startSession,
  advance,
  t,
  isNumericStep,
  optionsForStep,
  CROPS,
  type IvrSession,
  type IvrStep,
  type IvrOption,
} from "@/lib/ivr/stateMachine";
import {
  sendIvrOtp,
  verifyIvrOtp,
  finalizeIvrListing,
  loadIvrOffers,
  acceptIvrOffer,
  loadIvrPrices,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Line =
  | { kind: "prompt"; text: string; options?: IvrOption[]; time: string }
  | { kind: "caller"; text: string; time: string }
  | { kind: "note"; text: string; time: string }
  | { kind: "success"; text: string; time: string };

type Offer = {
  id: string;
  crop: string;
  buyerName: string;
  pricePerKg: number;
  quantityKg: number;
  netPerKg: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function now() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function inputTypeForStep(step: IvrStep): "menu" | "numeric" | "otp" {
  if (step === "ID_INPUT" || step === "LIST_QUANTITY" || step === "LIST_PRICE") {
    return "numeric";
  }
  if (step === "OTP_VERIFY") return "otp";
  return "menu";
}

/** Menu helpers — role-aware. */
function isMenuStep(step: IvrStep): boolean {
  return step === "MAIN_MENU" || step === "MAIN_MENU_FPO";
}
function menuStepFor(s: IvrSession): IvrStep {
  return s.role === "fpo" ? "MAIN_MENU_FPO" : "MAIN_MENU";
}
function menuPromptKey(s: IvrSession): "mainMenuFarmer" | "mainMenuFPO" {
  return s.role === "fpo" ? "mainMenuFPO" : "mainMenuFarmer";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IvrClient() {
  const [session, setSession] = useState<IvrSession | null>(null);
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  /* -------- transcript helpers -------- */
  function say(text: string, options?: IvrOption[]) {
    setTranscript((p) => [
      ...p,
      { kind: "prompt", text, options, time: now() },
    ]);
  }
  function hear(text: string) {
    setTranscript((p) => [...p, { kind: "caller", text, time: now() }]);
  }
  function note(text: string) {
    setTranscript((p) => [...p, { kind: "note", text, time: now() }]);
  }
  function success(text: string) {
    setTranscript((p) => [...p, { kind: "success", text, time: now() }]);
  }

  /* -------- call control -------- */
  function dial() {
    setCallActive(true);
    setTranscript([]);
    setOffers([]);
    setOfferIdx(0);
    setInput("");
    const turn = startSession();
    setSession(turn.session);
    say(turn.prompt, optionsForStep("WELCOME", turn.session.language));
  }

  function hangUp() {
    setCallActive(false);
    setSession(null);
    setInput("");
    note("— Call ended —");
  }

  /* -------- input handling -------- */
  async function handleKey(key: string) {
    if (!session || busy) return;

    if (isNumericStep(session.step)) {
      if (key === "#") {
        const value = input.trim();
        setInput("");
        if (!value) return;
        await submitInput(value);
        return;
      }
      if (key === "*") {
        setInput("");
        return;
      }
      setInput((prev) => prev + key);
      return;
    }

    await submitInput(key);
  }

  async function submitInput(raw: string) {
    if (!session || busy) return;
    const clean = raw.trim();
    if (!clean) return;
    setBusy(true);
    try {
      /* ------------------------------------------------------- */
      /* STEP 1: ID input                                        */
      /* ------------------------------------------------------- */
      if (session.step === "ID_INPUT") {
        const digits = clean.replace(/\D/g, "");
        hear(`KL-${digits}`);

        const res = await sendIvrOtp(digits);
        if (!res.ok) {
          say(res.error);
          setBusy(false);
          return;
        }

        const data = res.data as { phone: string };
        say(t("otpSending", session.language));
        note(`OTP sent to ${data.phone}`);
        if (res.demoOtp) {
          note(
            `[Demo] OTP is ${res.demoOtp} — in production this is sent via SMS`
          );
        }

        setSession({
          ...session,
          krishilinkId: `KL-${digits}`,
          step: "OTP_VERIFY",
        });
        setBusy(false);
        return;
      }

      /* ------------------------------------------------------- */
      /* STEP 2: OTP verify                                      */
      /* ------------------------------------------------------- */
      if (session.step === "OTP_VERIFY") {
        const otp = clean.replace(/\D/g, "");
        hear(otp);

        if (!session.krishilinkId) {
          say("Session lost. Please call again.");
          setBusy(false);
          return;
        }

        const res = await verifyIvrOtp(session.krishilinkId, otp);
        if (!res.ok) {
          say(res.error);
          const turn = advance(session, otp, { otpVerified: false });
          setSession(turn.session);
          if (!turn.terminal) {
            say("Please try again. Type the OTP and press #.");
          } else {
            say(turn.prompt);
            setTimeout(hangUp, 2500);
          }
          setBusy(false);
          return;
        }

        const data = res.data as { farmerId: string };
        const turn = advance(session, otp, {
          otpVerified: true,
          farmerId: data.farmerId,
        });
        setSession(turn.session);
        success("Verified successfully");
        say(
          turn.prompt,
          optionsForStep(turn.session.step, turn.session.language)
        );
        setBusy(false);
        return;
      }

      /* ------------------------------------------------------- */
      /* STEP 3: async branches from main menu (role-aware)      */
      /* ------------------------------------------------------- */
      if (isMenuStep(session.step) && clean === "2") {
        const label =
          clean === "2"
            ? session.role === "fpo"
              ? "2 · Hear group offers"
              : "2 · Hear offers"
            : clean;
        hear(label);
        await handleOffersLoad();
        return;
      }
      if (isMenuStep(session.step) && clean === "3") {
        hear("3 · Today's mandi prices");
        await handlePricesLoad();
        return;
      }
      if (session.step === "LIST_CONFIRM" && clean === "1") {
        hear("1 · Confirm");
        await handleCreateListing();
        return;
      }
      if (session.step === "OFFERS_LIST" && clean !== "*") {
        hear(clean);
        await handleOfferInput(clean);
        return;
      }
      if (session.step === "PRICES_SHOW" && clean !== "*") {
        hear(clean);
        say("Press * to return to the main menu.");
        setBusy(false);
        return;
      }

      /* ------------------------------------------------------- */
      /* STEP 4: generic advance                                 */
      /* ------------------------------------------------------- */
      const prettyLabel = prettyInputLabel(
        session.step,
        clean,
        session.language
      );
      hear(prettyLabel);

      const turn = advance(session, clean);
      setSession(turn.session);
      say(
        turn.prompt,
        optionsForStep(turn.session.step, turn.session.language)
      );
      if (turn.terminal) setTimeout(hangUp, 4000);
      setBusy(false);
    } catch (e) {
      say((e as Error).message);
      setBusy(false);
    }
  }

  /* -------- business-logic branches -------- */
  async function handleCreateListing() {
    if (!session || !session.farmerId) return;
    const res = await finalizeIvrListing(session.farmerId, session.draft);
    if (!res.ok) {
      say("Sorry, could not save. " + res.error);
      setBusy(false);
      return;
    }
    success("Crop listed successfully");
    say(t("listingCreated", session.language));

    const nextStep = menuStepFor(session);
    const nextSession = { ...session, draft: {}, step: nextStep };
    setSession(nextSession);
    say(
      t(menuPromptKey(session), session.language),
      optionsForStep(nextStep, session.language)
    );
    setBusy(false);
  }

  async function handleOffersLoad() {
    if (!session || !session.farmerId) return;
    const res = await loadIvrOffers(session.farmerId);
    if (!res.ok) {
      say("Could not load offers.");
      setBusy(false);
      return;
    }
    const data = res.data as { offers: Offer[]; count: number };
    setOffers(data.offers);
    setOfferIdx(0);

    if (data.count === 0) {
      say(t("noOffers", session.language));
      setSession({ ...session, step: "OFFERS_LIST" });
      setBusy(false);
      return;
    }

    say(t("offersIntro", session.language, { count: data.count }));
    readOffer(0, data.offers, session);
    setSession({ ...session, step: "OFFERS_LIST" });
    setBusy(false);
  }

  function readOffer(idx: number, list: Offer[], s: IvrSession) {
    const o = list[idx];
    const options: IvrOption[] = [
      ...(idx + 1 < list.length
        ? [{ key: "1", label: "Next offer" } as IvrOption]
        : []),
      {
        key: "2",
        label: "Accept",
        description: `₹${o.netPerKg.toFixed(2)}/kg net`,
      },
      { key: "3", label: "Reject" },
    ];
    say(
      t("offerRead", s.language, {
        n: idx + 1,
        total: list.length,
        buyer: o.buyerName,
        price: o.pricePerKg,
        qty: o.quantityKg,
        net: o.netPerKg,
      }),
      options
    );
  }

  async function handleOfferInput(cmd: string) {
    if (!session) return;
    if (cmd === "*") {
      const turn = advance(session, "*");
      setSession(turn.session);
      say(
        turn.prompt,
        optionsForStep(turn.session.step, turn.session.language)
      );
      setBusy(false);
      return;
    }
    if (cmd === "1") {
      const next = offerIdx + 1;
      if (next >= offers.length) {
        say(t("offersDone", session.language));
        setBusy(false);
        return;
      }
      setOfferIdx(next);
      readOffer(next, offers, session);
      setBusy(false);
      return;
    }
    if (cmd === "2") {
      if (!session.farmerId) {
        setBusy(false);
        return;
      }
      const o = offers[offerIdx];
      const res = await acceptIvrOffer(session.farmerId, o.id);
      if (!res.ok) {
        say("Sorry, could not accept. " + res.error);
        setBusy(false);
        return;
      }
      success("Offer accepted");
      say(t("accepted", session.language));

      const nextStep = menuStepFor(session);
      const nextSession = { ...session, step: nextStep };
      setSession(nextSession);
      say(
        t(menuPromptKey(session), session.language),
        optionsForStep(nextStep, session.language)
      );
      setBusy(false);
      return;
    }
    if (cmd === "3") {
      say(t("rejected", session.language));
      setBusy(false);
      return;
    }
    say(t("unknown", session.language));
    setBusy(false);
  }

  async function handlePricesLoad() {
    if (!session) return;
    const res = await loadIvrPrices();
    if (!res.ok) {
      say("Could not load prices.");
      setBusy(false);
      return;
    }
    const data = res.data as {
      prices: { crop: string; modal_price: number }[];
    };
    say(t("pricesIntro", session.language));
    data.prices.forEach((p) => {
      say(`• ${p.crop}: ₹${p.modal_price} / kg`);
    });
    say(t("pricesDone", session.language), [
      { key: "*", label: "Back to main menu" },
    ]);
    setSession({ ...session, step: "PRICES_SHOW" });
    setBusy(false);
  }

  /* -------- derived UI state -------- */
  const numericMode = session ? isNumericStep(session.step) : false;
  const inputType = session ? inputTypeForStep(session.step) : "menu";

  const promptLine = useMemo(() => {
    if (!session) return null;
    if (session.step === "ID_INPUT") return "Enter your 6-digit KrishiLink ID";
    if (session.step === "OTP_VERIFY") return "Enter the 6-digit OTP";
    if (session.step === "LIST_QUANTITY") return "Enter quantity in kilograms";
    if (session.step === "LIST_PRICE") return "Enter expected price per kg";
    return null;
  }, [session]);

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
      {/* ================= PHONE FRAME ================= */}
      <div className="mx-auto w-full max-w-[400px] lg:sticky lg:top-24 lg:self-start">
        <div className="relative rounded-[44px] border-[10px] border-[#0F1F1A] bg-[#0F1F1A] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)]">
          <div className="rounded-[36px] bg-gradient-to-b from-[#F8F9FA] to-[#EAF5EE] p-5">
            <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-[#0F1F1A]/20" />

            <div className="mb-4 flex items-center justify-between text-[10px] text-[#6B7A74]">
              <span className="font-medium">KrishiLink IVR</span>
              <span className="flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    callActive ? "animate-pulse bg-[#2E7D32]" : "bg-[#C62828]"
                  }`}
                />
                {callActive ? "Live" : "Idle"}
              </span>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-inner">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
                {callActive ? "Call in progress" : "Ready to dial"}
              </p>
              <p className="font-display mt-2 text-2xl font-bold text-[#1B4D3E]">
                📞 1800-KRISHI-1
              </p>
              <p className="mt-1 text-[11px] text-[#6B7A74]">
                Toll-free · No app · No internet
              </p>

              {callActive ? (
                <button
                  onClick={hangUp}
                  className="mt-4 w-full rounded-full bg-[#C62828] px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  End call
                </button>
              ) : (
                <button
                  onClick={dial}
                  className="mt-4 w-full rounded-full bg-[#2E7D32] px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  Dial now
                </button>
              )}
            </div>

            {callActive && numericMode && (
              <div className="mt-4 rounded-2xl border-2 border-[#2E7D32] bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
                  {promptLine}
                </p>
                <div className="mt-2 flex items-baseline gap-1 font-display text-3xl font-bold text-[#1B4D3E]">
                  {session?.step === "ID_INPUT" && (
                    <span className="text-[#6B7A74]">KL-</span>
                  )}
                  <span className="flex-1 tracking-[0.3em]">
                    {input || <span className="text-[#A5D6A7]">______</span>}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-[#6B7A74]">
                  Type digits · press <strong>#</strong> to submit · press{" "}
                  <strong>*</strong> to clear
                </p>
              </div>
            )}

            {callActive && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  "*",
                  "0",
                  "#",
                ].map((k) => (
                  <button
                    key={k}
                    onClick={() => handleKey(k)}
                    disabled={busy}
                    className="rounded-xl border border-[#E4EBE6] bg-white py-3 text-lg font-semibold text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE] active:scale-95 disabled:opacity-40"
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}

            {busy && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#6B7A74]">
                <ButtonSpinner size={12} /> Processing…
              </div>
            )}

            {callActive && inputType === "numeric" && (
              <p className="mt-3 text-center text-[10px] text-[#6B7A74]">
                Tip: You can also tap an option on the right side
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ================= TRANSCRIPT ================= */}
      <div className="flex flex-col overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
        <div className="flex items-center justify-between border-b border-[#E4EBE6] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5EE] text-[#1B4D3E]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <div>
              <p className="font-display text-sm font-bold text-[#1B4D3E]">
                Live transcript
              </p>
              <p className="text-[10px] text-[#6B7A74]">
                {transcript.length} turns · every action writes to the database
              </p>
            </div>
          </div>
          {callActive && (
            <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#2E7D32]">
              ● Active
            </span>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto p-6"
          style={{ maxHeight: 640, minHeight: 520 }}
        >
          {transcript.length === 0 ? (
            <EmptyState />
          ) : (
            transcript.map((line, i) => (
              <TranscriptLine
                key={i}
                line={line}
                busy={busy}
                onOptionClick={(key) => submitInput(key)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF5EE] text-3xl">
        📞
      </div>
      <p className="mt-4 text-sm font-medium text-[#1B4D3E]">
        Ready to simulate a call
      </p>
      <p className="mt-1 max-w-sm text-xs text-[#6B7A74]">
        Press <strong>Dial now</strong> to start. You&apos;ll need a KrishiLink
        ID — any farmer, buyer, or FPO account works. The demo shows the OTP on
        screen.
      </p>
    </div>
  );
}

function TranscriptLine({
  line,
  busy,
  onOptionClick,
}: {
  line: Line;
  busy: boolean;
  onOptionClick: (key: string) => void;
}) {
  if (line.kind === "note") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-full bg-[#FFF8E1] px-4 py-1.5 text-center text-[11px] font-medium text-[#B26A00]">
          {line.text}
        </div>
      </div>
    );
  }

  if (line.kind === "success") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-full bg-[#EAF5EE] px-4 py-1.5 text-center text-[11px] font-semibold text-[#2E7D32]">
          ✓ {line.text}
        </div>
      </div>
    );
  }

  if (line.kind === "caller") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#1B4D3E] px-4 py-2.5 text-sm text-white">
          <p className="font-medium">{line.text}</p>
          <p className="mt-1 text-[9px] text-white/60">
            👤 Caller · {line.time}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-3">
        <div className="rounded-2xl rounded-tl-sm bg-[#F8F9FA] px-4 py-3 text-sm text-[#0F1F1A]">
          <p className="leading-relaxed">{line.text}</p>
          <p className="mt-1.5 text-[9px] text-[#6B7A74]">
            🤖 IVR · {line.time}
          </p>
        </div>

        {line.options && line.options.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {line.options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onOptionClick(opt.key)}
                disabled={busy}
                className="group flex items-center gap-3 rounded-xl border border-[#E4EBE6] bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#2E7D32] hover:shadow-[0_10px_20px_-10px_rgba(27,77,62,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF5EE] text-xs font-bold text-[#1B4D3E] transition-colors group-hover:bg-[#1B4D3E] group-hover:text-white">
                  {opt.key === "*" ? "←" : opt.key}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#0F1F1A]">
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="block text-[11px] text-[#6B7A74]">
                      {opt.description}
                    </span>
                  )}
                </span>
                <span className="text-[#2E7D32] opacity-0 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function prettyInputLabel(
  step: IvrStep,
  raw: string,
  lang: "en" | "hi" | "kn"
): string {
  const L = (en: string, hi: string, kn: string) =>
    lang === "hi" ? hi : lang === "kn" ? kn : en;

  switch (step) {
    case "WELCOME":
      return raw === "1" ? "English" : raw === "2" ? "हिन्दी" : "ಕನ್ನಡ";
    case "ROLE_SELECT":
      if (raw === "1") return L("Farmer", "किसान", "ರೈತ");
      if (raw === "2") return L("Buyer", "खरीदार", "ಖರೀದಿದಾರ");
      if (raw === "3") return L("FPO", "एफपीओ", "ಎಫ್‌ಪಿಒ");
      return raw;
    case "LIST_CROP": {
      const c = CROPS.find((x) => x.key === raw);
      return c ? c.name : raw;
    }
    case "LIST_QUALITY":
      return raw === "1" ? "Grade A" : raw === "2" ? "Grade B" : "Grade C";
    case "LIST_CONFIRM":
      return raw === "1" ? "Confirm" : "Cancel";
    case "MAIN_MENU":
    case "MAIN_MENU_FPO": {
      const map: Record<string, string> = {
        "1":
          step === "MAIN_MENU_FPO"
            ? L("List a member's crop", "सदस्य की फसल", "ಸದಸ್ಯರ ಬೆಳೆ")
            : L("List my crop", "फसल सूचीबद्ध करें", "ಬೆಳೆ ಪಟ್ಟಿ ಮಾಡಿ"),
        "2":
          step === "MAIN_MENU_FPO"
            ? L("Hear group offers", "समूह ऑफर सुनें", "ಗುಂಪು ಆಫರ್")
            : L("Hear offers", "ऑफर सुनें", "ಆಫರ್ ಕೇಳಿ"),
        "3": L("Today's mandi prices", "आज के मंडी भाव", "ಇಂದಿನ ಮಂಡಿ ದರ"),
        "0": L("Talk to an operator", "ऑपरेटर से बात करें", "ಆಪರೇಟರ್"),
      };
      return map[raw] ?? raw;
    }
    default:
      return raw;
  }
}