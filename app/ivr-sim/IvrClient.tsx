"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  startSession,
  advance,
  t,
  buildContribSummary,
  isNumericStep,
  optionsForStep,
  CROPS,
  type IvrSession,
  type IvrStep,
  type IvrOption,
  type FpoMember,
} from "@/lib/ivr/stateMachine";
import {
  sendIvrOtp,
  verifyIvrOtp,
  farmerCreateListing,
  farmerLoadOffers,
  farmerAcceptOffer,
  fpoLoadMembers,
  fpoCreatePoolWithContributions,
  fpoLoadOffers,
  fpoAcceptPoolOffer,
  buyerLoadListingsByCrop,
  buyerPlaceOffer,
  buyerLoadBids,
  buyerLoadOrders,
  loadIvrPrices,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

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
  _source: "listing" | "pool";
};

type BuyerListing = {
  id: string;
  crop: string;
  grade: string;
  price: number;
  quantity: number;
  district: string;
  farmerName: string;
};

function now() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function inputTypeForStep(step: IvrStep): "menu" | "numeric" | "otp" {
  if (
    step === "ID_INPUT" ||
    step === "LIST_QUANTITY" ||
    step === "LIST_PRICE" ||
    step === "FPO_CONTRIB_MEMBER" ||
    step === "BUYER_OFFER_QTY" ||
    step === "BUYER_OFFER_PRICE"
  ) {
    return "numeric";
  }
  if (step === "OTP_VERIFY") return "otp";
  return "menu";
}

function isMenuStep(step: IvrStep): boolean {
  return (
    step === "MAIN_MENU" ||
    step === "MAIN_MENU_FPO" ||
    step === "MAIN_MENU_BUYER"
  );
}

function menuStepFor(s: IvrSession): IvrStep {
  if (s.role === "fpo") return "MAIN_MENU_FPO";
  if (s.role === "buyer") return "MAIN_MENU_BUYER";
  return "MAIN_MENU";
}

function menuPromptKey(
  s: IvrSession
): "mainMenuFarmer" | "mainMenuFPO" | "mainMenuBuyer" {
  if (s.role === "fpo") return "mainMenuFPO";
  if (s.role === "buyer") return "mainMenuBuyer";
  return "mainMenuFarmer";
}

export default function IvrClient() {
  const [session, setSession] = useState<IvrSession | null>(null);
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const [buyerListings, setBuyerListings] = useState<BuyerListing[]>([]);
  const [buyerListingIdx, setBuyerListingIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  function say(text: string, options?: IvrOption[]) {
    setTranscript((p) => [...p, { kind: "prompt", text, options, time: now() }]);
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

  function dial() {
    setCallActive(true);
    setTranscript([]);
    setOffers([]);
    setOfferIdx(0);
    setBuyerListings([]);
    setBuyerListingIdx(0);
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
      /* -------- ID input -------- */
      if (session.step === "ID_INPUT") {
        const digits = clean.replace(/\D/g, "");
        hear(digits);
        const res = await sendIvrOtp(digits);
        if (!res.ok) {
          say(res.error);
          setBusy(false);
          return;
        }
        const data = res.data as { phone: string };
        say(t("otpSending", session.language));
        note(`OTP sent to ${data.phone}`);
        if (res.demoOtp) note(`[Demo] OTP is ${res.demoOtp}`);
        setSession({
          ...session,
          krishilinkId: `KL-${digits}`,
          step: "OTP_VERIFY",
        });
        setBusy(false);
        return;
      }

      /* -------- OTP -------- */
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
          if (!turn.terminal) say("Please try again. Type the OTP and press #.");
          else {
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

      /* -------- FARMER/FPO: hear offers -------- */
      if (isMenuStep(session.step) && clean === "2" && session.role !== "buyer") {
        hear(session.role === "fpo" ? "2 · Hear group offers" : "2 · Hear offers");
        await handleOffersLoad();
        return;
      }

      /* -------- All roles: prices -------- */
      if (isMenuStep(session.step) && clean === "3" && session.role !== "buyer") {
        hear("3 · Today's mandi prices");
        await handlePricesLoad();
        return;
      }

      /* -------- BUYER main menu branches -------- */
      if (session.step === "MAIN_MENU_BUYER" && clean === "2") {
        hear("2 · Hear my bids");
        await handleBuyerBidsLoad();
        return;
      }
      if (session.step === "MAIN_MENU_BUYER" && clean === "3") {
        hear("3 · Check my orders");
        await handleBuyerOrdersLoad();
        return;
      }

      /* -------- BUYER crop select -------- */
      if (session.step === "BUYER_CROP_SELECT") {
        const crop = CROPS.find((c) => c.key === clean);
        if (!crop) {
          say(
            "Press 1 Tomato, 2 Onion, 3 Potato, 4 Wheat, 5 Rice.",
            optionsForStep("BUYER_CROP_SELECT", session.language)
          );
          setBusy(false);
          return;
        }
        hear(crop.name);
        await handleBuyerListingsLoad(crop.name);
        return;
      }

      /* -------- BUYER listing navigation & bid start -------- */
      if (session.step === "BUYER_LISTING_LIST") {
        // User can press "2", "3", "4" to bid on listing 1, 2, 3
        if (clean === "1" && buyerListingIdx + 1 < buyerListings.length) {
          const next = buyerListingIdx + 1;
          setBuyerListingIdx(next);
          hear("Next listing");
          readBuyerListing(next, buyerListings);
          setBusy(false);
          return;
        }
        if (["2", "3", "4"].includes(clean)) {
          const pickIdx = Number(clean) - 2;
          const picked = buyerListings[pickIdx];
          if (picked) {
            hear(`Bid on listing ${pickIdx + 1}`);
            startBuyerOffer(picked);
            setBusy(false);
            return;
          }
        }
        if (clean === "*") {
          const turn = advance(session, "*");
          setSession(turn.session);
          say(
            turn.prompt,
            optionsForStep(turn.session.step, turn.session.language)
          );
          setBusy(false);
          return;
        }
        say("Press the number shown to bid, 1 for next, or * to go back.");
        setBusy(false);
        return;
      }

      /* -------- BUYER offer qty -------- */
      if (session.step === "BUYER_OFFER_QTY") {
        const digits = clean.replace(/[^0-9.]/g, "");
        hear(`${digits} kg`);
        const turn = advance(session, digits);
        setSession(turn.session);
        say(turn.prompt, optionsForStep(turn.session.step, turn.session.language));
        setBusy(false);
        return;
      }

      /* -------- BUYER offer price -------- */
      if (session.step === "BUYER_OFFER_PRICE") {
        const digits = clean.replace(/[^0-9.]/g, "");
        hear(`₹${digits}/kg`);
        const turn = advance(session, digits);
        setSession(turn.session);
        say(turn.prompt, optionsForStep(turn.session.step, turn.session.language));
        setBusy(false);
        return;
      }

      /* -------- BUYER offer confirm -------- */
      if (session.step === "BUYER_OFFER_CONFIRM" && clean === "1") {
        hear("1 · Confirm");
        await handleBuyerPlaceOffer();
        return;
      }
      if (session.step === "BUYER_OFFER_CONFIRM" && clean === "2") {
        hear("2 · Cancel");
        const turn = advance(session, "2");
        setSession(turn.session);
        say(
          turn.prompt,
          optionsForStep(turn.session.step, turn.session.language)
        );
        setBusy(false);
        return;
      }

      /* -------- FARMER/FPO: list confirm -------- */
      if (session.step === "LIST_CONFIRM" && clean === "1") {
        hear("1 · Confirm");
        if (session.role === "fpo") {
          await handleFpoStartContributions();
        } else {
          await handleCreateListing();
        }
        return;
      }

      /* -------- FPO contributions -------- */
      if (session.step === "FPO_CONTRIB_MEMBER") {
        const digits = clean.replace(/[^0-9.]/g, "");
        hear(`${digits} kg`);
        const turn = advance(session, digits);
        setSession(turn.session);
        if (turn.session.step === "FPO_CONTRIB_CONFIRM") {
          const summary = buildContribSummary(
            turn.session,
            turn.session.language
          );
          say(
            summary,
            optionsForStep("FPO_CONTRIB_CONFIRM", turn.session.language)
          );
        } else {
          say(turn.prompt);
        }
        setBusy(false);
        return;
      }

      if (session.step === "FPO_CONTRIB_CONFIRM" && clean === "1") {
        hear("1 · Confirm pool");
        await handleFpoCreatePool();
        return;
      }
      if (session.step === "FPO_CONTRIB_CONFIRM" && clean === "2") {
        hear("2 · Cancel");
        const turn = advance(session, "2");
        setSession(turn.session);
        say(
          turn.prompt,
          optionsForStep(turn.session.step, turn.session.language)
        );
        setBusy(false);
        return;
      }

      /* -------- Offers list -------- */
      if (session.step === "OFFERS_LIST" && clean !== "*") {
        hear(clean);
        await handleOfferInput(clean);
        return;
      }

      /* -------- Prices show -------- */
      if (session.step === "PRICES_SHOW" && clean !== "*") {
        hear(clean);
        say("Press * to return to the main menu.");
        setBusy(false);
        return;
      }

      /* -------- Bids view / Orders view: back on * -------- */
      if (
        (session.step === "BUYER_BIDS_VIEW" ||
          session.step === "BUYER_ORDERS_VIEW") &&
        clean === "*"
      ) {
        const turn = advance(session, "*");
        setSession(turn.session);
        say(
          turn.prompt,
          optionsForStep(turn.session.step, turn.session.language)
        );
        setBusy(false);
        return;
      }
      if (
        session.step === "BUYER_BIDS_VIEW" ||
        session.step === "BUYER_ORDERS_VIEW"
      ) {
        say("Press * to return to the main menu.");
        setBusy(false);
        return;
      }

      /* -------- Generic advance -------- */
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

  /* ================= BUYER: load listings ================= */
  async function handleBuyerListingsLoad(crop: string) {
    if (!session) return;
    const res = await buyerLoadListingsByCrop(crop);
    if (!res.ok) {
      say("Could not load listings.");
      setBusy(false);
      return;
    }
    const data = res.data as { listings: BuyerListing[]; count: number };
    setBuyerListings(data.listings);
    setBuyerListingIdx(0);

    if (data.count === 0) {
      say(
        "No active listings for this crop right now. Press * to return.",
        []
      );
      setSession({ ...session, step: "BUYER_LISTING_LIST" });
      setBusy(false);
      return;
    }

    say(
      t("buyerListingList", session.language, { count: data.count })
    );
    readBuyerListing(0, data.listings);
    setSession({
      ...session,
      draft: { ...session.draft, crop },
      step: "BUYER_LISTING_LIST",
    });
    setBusy(false);
  }

  function readBuyerListing(idx: number, list: BuyerListing[]) {
    const l = list[idx];
    const bidKey = String(idx + 2); // Listing 1 = bid key "2"
    say(
      `Listing ${idx + 1}. ${l.crop}, Grade ${l.grade}, from ${
        l.district
      }. ${l.farmerName} asks ₹${l.price}/kg. Available ${l.quantity} kg.`,
      [
        { key: bidKey, label: `Bid on listing ${idx + 1}` },
        ...(idx + 1 < list.length
          ? [{ key: "1", label: "Next listing" } as IvrOption]
          : []),
        { key: "*", label: "Back to menu" },
      ]
    );
  }

  function startBuyerOffer(listing: BuyerListing) {
    if (!session) return;
    const newSession: IvrSession = {
      ...session,
      draft: {
        ...session.draft,
        buyerListingId: listing.id,
        buyerListingCrop: listing.crop,
        buyerListingPrice: listing.price,
        buyerOfferQty: undefined,
        buyerOfferPrice: undefined,
      },
      step: "BUYER_OFFER_QTY",
    };
    say(
      t("buyerOfferQtyAsk", session.language, {
        crop: listing.crop,
        price: listing.price,
      })
    );
    setSession(newSession);
  }

  async function handleBuyerPlaceOffer() {
    if (!session || !session.farmerId) return;
    const listingId = session.draft.buyerListingId;
    const price = session.draft.buyerOfferPrice;
    const qty = session.draft.buyerOfferQty;

    if (!listingId || !price || !qty) {
      say("Missing offer details. Please try again.");
      setBusy(false);
      return;
    }

    const res = await buyerPlaceOffer(session.farmerId, listingId, price, qty);
    if (!res.ok) {
      say("Could not place offer. " + res.error);
      setBusy(false);
      return;
    }

    success("Offer placed successfully");
    say(t("buyerOfferPlaced", session.language));

    const nextStep = menuStepFor(session);
    const nextSession: IvrSession = {
      ...session,
      draft: {},
      step: nextStep,
    };
    setSession(nextSession);
    say(
      t(menuPromptKey(session), session.language),
      optionsForStep(nextStep, session.language)
    );
    setBusy(false);
  }

  async function handleBuyerBidsLoad() {
    if (!session || !session.farmerId) return;
    const res = await buyerLoadBids(session.farmerId);
    if (!res.ok) {
      say("Could not load bids.");
      setBusy(false);
      return;
    }
    const data = res.data as {
      bids: {
        id: string;
        crop: string;
        price: number;
        quantity: number;
        status: string;
      }[];
      count: number;
    };

    if (data.count === 0) {
      say(t("buyerNoBids", session.language), [
        { key: "*", label: "Main menu" },
      ]);
      setSession({ ...session, step: "BUYER_BIDS_VIEW" });
      setBusy(false);
      return;
    }

    say(t("buyerBidsIntro", session.language, { count: data.count }));
    data.bids.forEach((b, i) => {
      say(
        t("buyerBidRead", session.language, {
          n: i + 1,
          total: data.count,
          crop: b.crop,
          price: b.price,
          qty: b.quantity,
          status: b.status.replace(/_/g, " "),
        })
      );
    });
    say(t("buyerBidsDone", session.language), [
      { key: "*", label: "Main menu" },
    ]);
    setSession({ ...session, step: "BUYER_BIDS_VIEW" });
    setBusy(false);
  }

  async function handleBuyerOrdersLoad() {
    if (!session || !session.farmerId) return;
    const res = await buyerLoadOrders(session.farmerId);
    if (!res.ok) {
      say("Could not load orders.");
      setBusy(false);
      return;
    }
    const data = res.data as {
      orders: { id: string; crop: string; total: number; status: string }[];
      count: number;
    };

    if (data.count === 0) {
      say(t("buyerNoOrders", session.language), [
        { key: "*", label: "Main menu" },
      ]);
      setSession({ ...session, step: "BUYER_ORDERS_VIEW" });
      setBusy(false);
      return;
    }

    say(t("buyerOrdersIntro", session.language, { count: data.count }));
    data.orders.forEach((o, i) => {
      say(
        t("buyerOrderRead", session.language, {
          n: i + 1,
          total: data.count,
          crop: o.crop,
          total_amt: o.total.toLocaleString("en-IN"),
          status: o.status.replace(/_/g, " "),
        })
      );
    });
    say(t("buyerOrdersDone", session.language), [
      { key: "*", label: "Main menu" },
    ]);
    setSession({ ...session, step: "BUYER_ORDERS_VIEW" });
    setBusy(false);
  }

  /* ================= FPO: contributions ================= */
  async function handleFpoStartContributions() {
    if (!session || !session.farmerId) return;
    const res = await fpoLoadMembers(session.farmerId);
    if (!res.ok) {
      say("Could not load members. " + res.error);
      setBusy(false);
      return;
    }
    const data = res.data as { members: FpoMember[] };
    const members = data.members ?? [];

    if (members.length === 0) {
      say(
        "You have no active members yet. Please add members from the web portal first."
      );
      setBusy(false);
      return;
    }

    const newSession: IvrSession = {
      ...session,
      fpoMembers: members,
      draft: {
        ...session.draft,
        contributions: [],
        memberIdx: 0,
      },
      step: "FPO_CONTRIB_MEMBER",
    };

    const first = members[0];
    say(
      `Now let's record contributions. Member 1 of ${
        members.length + 1
      }: ${first.name}.`
    );
    say(`How many kg is ${first.name} contributing? Type and press #.`);
    setSession(newSession);
    setBusy(false);
  }

  async function handleFpoCreatePool() {
    if (!session || !session.farmerId) return;
    const contributions = session.draft.contributions ?? [];

    const res = await fpoCreatePoolWithContributions(session.farmerId, {
      crop: session.draft.crop,
      quantityKg: session.draft.quantityKg,
      grade: session.draft.grade,
      pricePerKg: session.draft.pricePerKg,
      contributions,
    });

    if (!res.ok) {
      say("Sorry, could not create pool. " + res.error);
      setBusy(false);
      return;
    }

    success("FPO pool created — shares recorded");
    say(t("poolCreated", session.language));

    const nextStep = menuStepFor(session);
    const nextSession: IvrSession = {
      ...session,
      draft: {},
      fpoMembers: [],
      step: nextStep,
    };
    setSession(nextSession);
    say(
      t(menuPromptKey(session), session.language),
      optionsForStep(nextStep, session.language)
    );
    setBusy(false);
  }

  /* ================= FARMER: create listing ================= */
  async function handleCreateListing() {
    if (!session || !session.farmerId) return;
    const res = await farmerCreateListing(session.farmerId, session.draft);
    if (!res.ok) {
      say("Sorry, could not save. " + res.error);
      setBusy(false);
      return;
    }
    success("Crop listed on your farm account");
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

  /* ================= FARMER/FPO: offers ================= */
  async function handleOffersLoad() {
    if (!session || !session.farmerId) return;

    const res =
      session.role === "fpo"
        ? await fpoLoadOffers(session.farmerId)
        : await farmerLoadOffers(session.farmerId);

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
      `Offer ${idx + 1} of ${list.length}. Buyer ${o.buyerName}. ₹${
        o.pricePerKg
      }/kg for ${o.quantityKg} kg. Net ₹${o.netPerKg.toFixed(2)}/kg.`,
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
        say("That was the last offer.");
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
      const res =
        session.role === "fpo"
          ? await fpoAcceptPoolOffer(session.farmerId, o.id)
          : await farmerAcceptOffer(session.farmerId, o.id);

      if (!res.ok) {
        say("Sorry, could not accept. " + res.error);
        setBusy(false);
        return;
      }
      success(
        session.role === "fpo"
          ? "Pool offer accepted — payment will split"
          : "Offer accepted"
      );

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
      say("Offer rejected.");
      setBusy(false);
      return;
    }
    say("Sorry, I didn't understand.");
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
    say("Today's mandi prices:");
    data.prices.forEach((p) => {
      say(`• ${p.crop}: ₹${p.modal_price} / kg`);
    });
    say("Press * to return.", [{ key: "*", label: "Back to menu" }]);
    setSession({ ...session, step: "PRICES_SHOW" });
    setBusy(false);
  }

  const numericMode = session ? isNumericStep(session.step) : false;
  const inputType = session ? inputTypeForStep(session.step) : "menu";

  const promptLine = useMemo(() => {
    if (!session) return null;
    if (session.step === "ID_INPUT") return "Enter your 6-digit ID";
    if (session.step === "OTP_VERIFY") return "Enter the 6-digit OTP";
    if (session.step === "LIST_QUANTITY")
      return session.role === "fpo"
        ? "Total pool quantity (kg)"
        : "Quantity (kg)";
    if (session.step === "LIST_PRICE") return "Expected price (₹/kg)";
    if (session.step === "FPO_CONTRIB_MEMBER") {
      const idx = session.draft.memberIdx ?? 0;
      const m = session.fpoMembers[idx];
      return m ? `${m.name}'s contribution (kg)` : "Head contribution (kg)";
    }
    if (session.step === "BUYER_OFFER_QTY") return "Quantity to buy (kg)";
    if (session.step === "BUYER_OFFER_PRICE") return "Your offer price (₹/kg)";
    return null;
  }, [session]);

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
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
                    <span className="text-[#6B7A74]">
                      {session.role === "fpo" ? "KF-" : "KL-"}
                    </span>
                  )}
                  <span className="flex-1 tracking-[0.3em]">
                    {input || <span className="text-[#A5D6A7]">______</span>}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-[#6B7A74]">
                  Type digits · press <strong>#</strong> · <strong>*</strong> clears
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
          </div>
        </div>
      </div>

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
                {transcript.length} turns · Farmer · Buyer · FPO
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
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF5EE] text-3xl">
                📞
              </div>
              <p className="mt-4 text-sm font-medium text-[#1B4D3E]">
                Ready to simulate a call
              </p>
              <p className="mt-1 max-w-sm text-xs text-[#6B7A74]">
                Press <strong>Dial now</strong>. Farmer lists crops. Buyer
                browses & places offers. FPO pools members and splits revenue.
              </p>
            </div>
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
          <p className="font-medium whitespace-pre-line">{line.text}</p>
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
          <p className="leading-relaxed whitespace-pre-line">{line.text}</p>
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
    case "BUYER_CROP_SELECT":
    case "LIST_CROP": {
      const c = CROPS.find((x) => x.key === raw);
      return c ? c.name : raw;
    }
    case "LIST_QUALITY":
      return raw === "1" ? "Grade A" : raw === "2" ? "Grade B" : "Grade C";
    case "LIST_CONFIRM":
    case "BUYER_OFFER_CONFIRM":
    case "FPO_CONTRIB_CONFIRM":
      return raw === "1" ? "Confirm" : "Cancel";
    case "MAIN_MENU":
      return (
        {
          "1": "List my crop",
          "2": "Hear offers",
          "3": "Today's mandi prices",
          "0": "Talk to an operator",
        }[raw] ?? raw
      );
    case "MAIN_MENU_FPO":
      return (
        {
          "1": "List a member's crop",
          "2": "Hear group offers",
          "3": "Today's mandi prices",
          "0": "Talk to an operator",
        }[raw] ?? raw
      );
    case "MAIN_MENU_BUYER":
      return (
        {
          "1": "Browse crops",
          "2": "Hear my bids",
          "3": "Check my orders",
          "0": "Talk to an operator",
        }[raw] ?? raw
      );
    default:
      return raw;
  }
}