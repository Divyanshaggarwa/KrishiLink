/* ========================================================================
   KrishiLink IVR State Machine
   Provider-agnostic. Used by both the browser simulation AND (in production)
   the Exotel/Twilio webhook. Same flow, same inputs, same outputs.
   ======================================================================== */

export type IvrStep =
  | "WELCOME"
  | "LANGUAGE"
  | "MAIN_MENU"
  | "LIST_CROP"
  | "LIST_QUANTITY"
  | "LIST_QUALITY"
  | "LIST_PRICE"
  | "LIST_CONFIRM"
  | "OFFERS_LIST"
  | "OFFERS_ACCEPT"
  | "PRICES_MENU"
  | "PRICES_SHOW"
  | "END";

export interface IvrSession {
  step: IvrStep;
  language: "en" | "hi" | "kn";
  farmerId: string | null;
  draft: {
    crop?: string;
    quantityKg?: number;
    grade?: "A" | "B" | "C";
    pricePerKg?: number;
  };
  lastOfferId?: string;
}

export interface IvrTurn {
  session: IvrSession;
  prompt: string;
  options?: string[];
  terminal?: boolean;
}

export const CROPS = [
  { key: "1", name: "Tomato" },
  { key: "2", name: "Onion" },
  { key: "3", name: "Potato" },
  { key: "4", name: "Wheat" },
  { key: "5", name: "Rice" },
];

const PROMPTS = {
  en: {
    welcome:
      "Welcome to KrishiLink. Your bridge to fair prices. Press 1 for English, 2 for Hindi, 3 for Kannada.",
    mainMenu:
      "Main menu. Press 1 to list your crop, 2 to hear offers, 3 for today's prices, 0 to talk to an operator.",
    listCrop:
      "Which crop? Press 1 Tomato, 2 Onion, 3 Potato, 4 Wheat, 5 Rice.",
    listQuantity: "How many kilograms? Enter the number and press hash.",
    listQuality:
      "What is the quality? Press 1 for Grade A, 2 for Grade B, 3 for Grade C.",
    listPrice: "What is your expected price per kilogram? Enter the number.",
    listConfirm:
      "Please confirm: {crop}, {qty} kilograms, Grade {grade}, expected {price} rupees per kilogram. Press 1 to confirm, 2 to cancel.",
    listingCreated:
      "Your crop has been listed. Buyers will see it shortly. Thank you.",
    noOffers:
      "You have no pending offers right now. Press star to return to main menu.",
    offersIntro:
      "You have {count} pending offers. I will read them by best net price.",
    offerRead:
      "Offer {n} of {total}. Buyer {buyer}. Price {price} rupees per kilogram. Quantity {qty} kilograms. Net realization after costs is {net} rupees per kilogram. Press 1 to hear the next, 2 to accept this offer, 3 to reject it.",
    offersDone: "That was the last offer.",
    pricesIntro: "Today's mandi prices.",
    pricesLine: "{crop}: {price} rupees per kilogram.",
    pricesDone: "Press star to return to main menu.",
    accepted: "Offer accepted. Buyer will be notified. Thank you.",
    rejected: "Offer rejected.",
    unknown: "Sorry, I did not understand. Please try again.",
  },
  hi: {
    welcome:
      "कृषिलिंक में आपका स्वागत है। अंग्रेजी के लिए 1, हिंदी के लिए 2, कन्नड़ के लिए 3 दबाएं।",
    mainMenu:
      "मुख्य मेन्यू। फसल सूचीबद्ध करने के लिए 1, ऑफर सुनने के लिए 2, आज के दाम के लिए 3, ऑपरेटर से बात करने के लिए 0 दबाएं।",
    listCrop: "कौन सी फसल? 1 टमाटर, 2 प्याज, 3 आलू, 4 गेहूं, 5 चावल।",
    listQuantity: "कितने किलोग्राम? नंबर दर्ज करें और हैश दबाएं।",
    listQuality: "गुणवत्ता क्या है? 1 ग्रेड A, 2 ग्रेड B, 3 ग्रेड C।",
    listPrice: "प्रति किलोग्राम अपेक्षित मूल्य? नंबर दर्ज करें।",
    listConfirm:
      "पुष्टि करें: {crop}, {qty} किलोग्राम, ग्रेड {grade}, अपेक्षित {price} रुपये प्रति किलो। पुष्टि के लिए 1, रद्द करने के लिए 2।",
    listingCreated: "आपकी फसल सूचीबद्ध हो गई है। धन्यवाद।",
    noOffers: "अभी कोई ऑफर नहीं है। मुख्य मेन्यू के लिए स्टार दबाएं।",
    offersIntro: "आपके {count} ऑफर हैं। मैं सबसे अच्छे शुद्ध मूल्य के अनुसार पढ़ूंगा।",
    offerRead:
      "ऑफर {n} / {total}। खरीदार {buyer}। कीमत {price} रुपये प्रति किलो। मात्रा {qty} किलो। शुद्ध लाभ {net} रुपये प्रति किलो। अगले के लिए 1, स्वीकार के लिए 2, अस्वीकार के लिए 3।",
    offersDone: "यह अंतिम ऑफर था।",
    pricesIntro: "आज के मंडी भाव।",
    pricesLine: "{crop}: {price} रुपये प्रति किलो।",
    pricesDone: "मुख्य मेन्यू के लिए स्टार दबाएं।",
    accepted: "ऑफर स्वीकार कर लिया गया। धन्यवाद।",
    rejected: "ऑफर अस्वीकार कर दिया गया।",
    unknown: "क्षमा करें, समझ नहीं आया। पुनः प्रयास करें।",
  },
  kn: {
    welcome:
      "ಕೃಷಿಲಿಂಕ್‌ಗೆ ಸ್ವಾಗತ. ಇಂಗ್ಲಿಷ್‌ಗೆ 1, ಹಿಂದಿಗೆ 2, ಕನ್ನಡಕ್ಕೆ 3 ಒತ್ತಿರಿ.",
    mainMenu:
      "ಮುಖ್ಯ ಮೆನು. ಬೆಳೆ ಪಟ್ಟಿ ಮಾಡಲು 1, ಆಫರ್ ಕೇಳಲು 2, ಇಂದಿನ ದರಗಳಿಗೆ 3, ಆಪರೇಟರ್‌ಗೆ 0 ಒತ್ತಿರಿ.",
    listCrop: "ಯಾವ ಬೆಳೆ? 1 ಟೊಮೆಟೊ, 2 ಈರುಳ್ಳಿ, 3 ಆಲೂಗಡ್ಡೆ, 4 ಗೋಧಿ, 5 ಅಕ್ಕಿ.",
    listQuantity: "ಎಷ್ಟು ಕಿಲೋಗ್ರಾಂ? ಸಂಖ್ಯೆ ನಮೂದಿಸಿ ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    listQuality: "ಗುಣಮಟ್ಟ ಏನು? 1 ಗ್ರೇಡ್ A, 2 ಗ್ರೇಡ್ B, 3 ಗ್ರೇಡ್ C.",
    listPrice: "ಪ್ರತಿ ಕಿಲೋ ನಿರೀಕ್ಷಿತ ಬೆಲೆ? ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.",
    listConfirm:
      "ಖಚಿತಪಡಿಸಿ: {crop}, {qty} ಕಿಲೋ, ಗ್ರೇಡ್ {grade}, ನಿರೀಕ್ಷಿತ {price} ರೂಪಾಯಿ. ಖಚಿತಪಡಿಸಲು 1, ರದ್ದುಗೊಳಿಸಲು 2.",
    listingCreated: "ನಿಮ್ಮ ಬೆಳೆ ಪಟ್ಟಿಯಾಗಿದೆ. ಧನ್ಯವಾದ.",
    noOffers: "ಈಗ ಯಾವುದೇ ಆಫರ್ ಇಲ್ಲ. ಮುಖ್ಯ ಮೆನುಗೆ ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    offersIntro: "ನಿಮ್ಮ {count} ಆಫರ್‌ಗಳಿವೆ.",
    offerRead:
      "ಆಫರ್ {n} / {total}. ಖರೀದಿದಾರ {buyer}. ಬೆಲೆ {price} ರೂ. ಪ್ರತಿ ಕಿಲೋ. ಪ್ರಮಾಣ {qty} ಕಿಲೋ. ನಿವ್ವಳ {net} ರೂ. ಮುಂದೆ 1, ಸ್ವೀಕರಿಸಲು 2, ತಿರಸ್ಕರಿಸಲು 3.",
    offersDone: "ಇದು ಕೊನೆಯ ಆಫರ್.",
    pricesIntro: "ಇಂದಿನ ಮಂಡಿ ಬೆಲೆಗಳು.",
    pricesLine: "{crop}: {price} ರೂಪಾಯಿ ಪ್ರತಿ ಕಿಲೋ.",
    pricesDone: "ಮುಖ್ಯ ಮೆನುಗೆ ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    accepted: "ಆಫರ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದ.",
    rejected: "ಆಫರ್ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ.",
    unknown: "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
} as const;

export function t(
  key: keyof (typeof PROMPTS)["en"],
  lang: "en" | "hi" | "kn",
  vars?: Record<string, string | number>
): string {
  let text = PROMPTS[lang][key] as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function startSession(farmerId: string | null): IvrTurn {
  const session: IvrSession = {
    step: "WELCOME",
    language: "en",
    farmerId,
    draft: {},
  };
  return { session, prompt: PROMPTS.en.welcome };
}

export function advance(session: IvrSession, input: string): IvrTurn {
  const lang = session.language;

  switch (session.step) {
    case "WELCOME": {
      if (input === "1") session.language = "en";
      else if (input === "2") session.language = "hi";
      else if (input === "3") session.language = "kn";
      else {
        return { session, prompt: PROMPTS[lang].unknown };
      }
      session.step = "MAIN_MENU";
      return { session, prompt: PROMPTS[session.language].mainMenu };
    }

    case "MAIN_MENU": {
      if (input === "1") {
        session.step = "LIST_CROP";
        return { session, prompt: PROMPTS[lang].listCrop };
      }
      if (input === "2") {
        session.step = "OFFERS_LIST";
        return { session, prompt: "Loading your offers…" };
      }
      if (input === "3") {
        session.step = "PRICES_MENU";
        return { session, prompt: "Loading mandi prices…" };
      }
      if (input === "0") {
        return {
          session,
          prompt:
            lang === "hi"
              ? "ऑपरेटर से जुड़ रहे हैं। कृपया प्रतीक्षा करें।"
              : lang === "kn"
              ? "ಆಪರೇಟರ್‌ಗೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ."
              : "Connecting to an operator. Please hold.",
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    case "LIST_CROP": {
      const crop = CROPS.find((c) => c.key === input);
      if (!crop) return { session, prompt: PROMPTS[lang].unknown };
      session.draft.crop = crop.name;
      session.step = "LIST_QUANTITY";
      return { session, prompt: PROMPTS[lang].listQuantity };
    }

    case "LIST_QUANTITY": {
      const clean = input.replace("#", "").replace("*", "");
      const qty = Number(clean);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { session, prompt: PROMPTS[lang].unknown };
      }
      session.draft.quantityKg = qty;
      session.step = "LIST_QUALITY";
      return { session, prompt: PROMPTS[lang].listQuality };
    }

    case "LIST_QUALITY": {
      const map: Record<string, "A" | "B" | "C"> = {
        "1": "A",
        "2": "B",
        "3": "C",
      };
      const grade = map[input];
      if (!grade) return { session, prompt: PROMPTS[lang].unknown };
      session.draft.grade = grade;
      session.step = "LIST_PRICE";
      return { session, prompt: PROMPTS[lang].listPrice };
    }

    case "LIST_PRICE": {
      const clean = input.replace("#", "").replace("*", "");
      const price = Number(clean);
      if (!Number.isFinite(price) || price <= 0) {
        return { session, prompt: PROMPTS[lang].unknown };
      }
      session.draft.pricePerKg = price;
      session.step = "LIST_CONFIRM";
      const confirm = t("listConfirm", lang, {
        crop: session.draft.crop ?? "",
        qty: session.draft.quantityKg ?? 0,
        grade: session.draft.grade ?? "",
        price: session.draft.pricePerKg ?? 0,
      });
      return { session, prompt: confirm };
    }

    case "LIST_CONFIRM": {
      if (input === "1") {
        return { session, prompt: "Saving your listing…" };
      }
      if (input === "2") {
        session.draft = {};
        session.step = "MAIN_MENU";
        return { session, prompt: PROMPTS[lang].mainMenu };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    case "OFFERS_LIST":
    case "OFFERS_ACCEPT": {
      if (input === "*") {
        session.step = "MAIN_MENU";
        return { session, prompt: PROMPTS[lang].mainMenu };
      }
      return { session, prompt: "Processing…" };
    }

    case "PRICES_MENU":
    case "PRICES_SHOW": {
      if (input === "*") {
        session.step = "MAIN_MENU";
        return { session, prompt: PROMPTS[lang].mainMenu };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    default:
      return { session, prompt: PROMPTS[lang].unknown, terminal: true };
  }
}