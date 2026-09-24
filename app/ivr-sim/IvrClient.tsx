"use client";

import { useState, useRef, useEffect } from "react";
import {
  startSession,
  advance,
  CROPS,
  t,
  type IvrSession,
  type IvrStep,
} from "@/lib/ivr/stateMachine";
import {
  finalizeIvrListing,
  loadIvrOffers,
  acceptIvrOffer,
  loadIvrPrices,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

type TranscriptLine = {
  from: "system" | "caller";
  text: string;
  time: string;
};

type Offer = {
  id: string;
  crop: string;
  buyerName: string;
  pricePerKg: number;
  quantityKg: number;
  netPerKg: number;
};

export default function IvrClient() {
  const [session, setSession] = useState<IvrSession | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const [prices, setPrices] = useState<{ crop: string; modal_price: number }[]>(
    []
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  function say(text: string) {
    setTranscript((prev) => [
      ...prev,
      { from: "system", text, time: now() },
    ]);
  }

  function hear(text: string) {
    setTranscript((prev) => [
      ...prev,
      { from: "caller", text, time: now() },
    ]);
  }

  function now() {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  async function dial() {
    setCallActive(true);
    setTranscript([]);
    setOffers([]);
    setOfferIdx(0);
    const turn = startSession(null);
    setSession(turn.session);
    say(turn.prompt);
  }

  function hangUp() {
    setCallActive(false);
    setSession(null);
    say("— Call ended —");
  }

  async function submitInput(raw: string) {
    if (!session || busy) return;
    const clean = raw.trim();
    if (!clean) return;
    setInput("");
    hear(clean);
    setBusy(true);
    try {
      // Special-case branch before generic advance
      if (session.step === "MAIN_MENU" && clean === "2") {
        await handleOffersLoad();
        return;
      }
      if (session.step === "MAIN_MENU" && clean === "3") {
        await handlePricesLoad();
        return;
      }
      if (session.step === "LIST_CONFIRM" && clean === "1") {
        await handleCreateListing();
        return;
      }
      if (
        (session.step === "OFFERS_LIST" || session.step === "OFFERS_ACCEPT") &&
        clean !== "*"
      ) {
        await handleOfferInput(clean);
        return;
      }
      if ((session.step === "PRICES_MENU" || session.step === "PRICES_SHOW") && clean !== "*") {
        say(
          t("pricesDone", session.language) === "Press star to return to main menu."
            ? "Press * to return to main menu."
            : "Press * to return to main menu."
        );
        return;
      }

      // Generic state machine advance
      const turn = advance(session, clean);
      setSession(turn.session);
      say(turn.prompt);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateListing() {
    if (!session) return;
    const res = await finalizeIvrListing(session.draft);
    if (!res.ok) {
      say("Sorry, could not save. " + res.error);
      setBusy(false);
      return;
    }
    say(t("listingCreated", session.language));
    const next = { ...session, draft: {}, step: "MAIN_MENU" as IvrStep };
    setSession(next);
    setBusy(false);
  }

  async function handleOffersLoad() {
    if (!session) return;
    const res = await loadIvrOffers();
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
    say(
      t("offerRead", s.language, {
        n: idx + 1,
        total: list.length,
        buyer: o.buyerName,
        price: o.pricePerKg,
        qty: o.quantityKg,
        net: o.netPerKg,
      })
    );
  }

  async function handleOfferInput(cmd: string) {
    if (!session) return;
    if (cmd === "*") {
      const turn = advance(session, "*");
      setSession(turn.session);
      say(turn.prompt);
      setBusy(false);
      return;
    }
    if (cmd === "1") {
      // next
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
      // accept
      const o = offers[offerIdx];
      const res = await acceptIvrOffer(o.id);
      if (!res.ok) {
        say("Sorry, could not accept. " + res.error);
        setBusy(false);
        return;
      }
      say(t("accepted", session.language));
      setSession({ ...session, step: "MAIN_MENU" });
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
    const data = res.data as { prices: { crop: string; modal_price: number }[] };
    setPrices(data.prices);
    say(t("pricesIntro", session.language));
    data.prices.forEach((p) => {
      say(
        t("pricesLine", session.language, {
          crop: p.crop,
          price: p.modal_price,
        })
      );
    });
    say(t("pricesDone", session.language));
    setSession({ ...session, step: "PRICES_SHOW" });
    setBusy(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      {/* Phone frame */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="relative rounded-[40px] border-[10px] border-[#0F1F1A] bg-[#0F1F1A] p-2 shadow-2xl">
          <div className="rounded-[32px] bg-gradient-to-b from-[#F8F9FA] to-[#EAF5EE] p-5">
            {/* Notch */}
            <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-[#0F1F1A]/20" />

            {/* Status bar */}
            <div className="mb-4 flex items-center justify-between text-[10px] text-[#6B7A74]">
              <span>KrishiLink IVR</span>
              <span>{callActive ? "● Live" : "Idle"}</span>
            </div>

            {/* Big screen */}
            <div className="rounded-2xl bg-white p-4 shadow-inner">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
                {callActive ? "Call in progress" : "Ready to dial"}
              </p>
              <p className="font-display mt-2 text-2xl font-bold text-[#1B4D3E]">
                📞 1800-KRISHI-1
              </p>
              <p className="mt-1 text-[11px] text-[#6B7A74]">
                Toll-free · 24×7 · Hindi, English, Kannada
              </p>

              {callActive ? (
                <button
                  onClick={hangUp}
                  className="mt-4 w-full rounded-full bg-[#C62828] px-4 py-3 text-sm font-semibold text-white"
                >
                  End call
                </button>
              ) : (
                <button
                  onClick={dial}
                  className="mt-4 w-full rounded-full bg-[#2E7D32] px-4 py-3 text-sm font-semibold text-white"
                >
                  Dial now
                </button>
              )}
            </div>

            {/* Keypad */}
            {callActive && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
                  (k) => (
                    <button
                      key={k}
                      onClick={() => submitInput(k)}
                      disabled={busy}
                      className="rounded-xl border border-[#E4EBE6] bg-white py-3 text-lg font-semibold text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE] disabled:opacity-40"
                    >
                      {k}
                    </button>
                  )
                )}
              </div>
            )}

            {/* Manual input for large numbers */}
            {callActive && (
              <div className="mt-4 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitInput(input + "#");
                    }
                  }}
                  placeholder="Type quantity / price…"
                  className="flex-1 rounded-xl border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
                />
                <button
                  onClick={() => submitInput(input + "#")}
                  disabled={busy || !input.trim()}
                  className="rounded-xl bg-[#1B4D3E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}

            {busy && (
              <div className="mt-3 flex items-center gap-2 text-xs text-[#6B7A74]">
                <ButtonSpinner size={12} /> Processing…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex flex-col rounded-[24px] border border-[#E4EBE6] bg-white">
        <div className="flex items-center justify-between border-b border-[#E4EBE6] px-5 py-3">
          <p className="font-display text-sm font-bold text-[#1B4D3E]">
            Live transcript
          </p>
          <span className="rounded-full bg-[#EAF5EE] px-2.5 py-0.5 text-[10px] font-medium text-[#2E7D32]">
            {transcript.length} turns
          </span>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto p-5"
          style={{ maxHeight: 560, minHeight: 480 }}
        >
          {transcript.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-[#6B7A74]">
                Press <strong>Dial now</strong> to start the simulated call.
              </p>
              <p className="mt-1 text-[11px] text-[#6B7A74]">
                The same state machine runs in production on Exotel/Twilio.
              </p>
            </div>
          ) : (
            transcript.map((line, i) => (
              <div
                key={i}
                className={`flex ${
                  line.from === "system" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    line.from === "system"
                      ? "rounded-tl-sm bg-[#EAF5EE] text-[#1B4D3E]"
                      : "rounded-tr-sm bg-[#1B4D3E] text-white"
                  }`}
                >
                  <p>{line.text}</p>
                  <p
                    className={`mt-1 text-[9px] ${
                      line.from === "system"
                        ? "text-[#1B4D3E]/60"
                        : "text-white/60"
                    }`}
                  >
                    {line.from === "system" ? "🤖 IVR" : "👤 Caller"} ·{" "}
                    {line.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}