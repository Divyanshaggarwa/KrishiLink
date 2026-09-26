/* ========================================================================
   KrishiLink IVR State Machine — v3 with FPO support
   ======================================================================== */

export type IvrStep =
  | "WELCOME"
  | "LANGUAGE"
  | "ROLE_SELECT"
  | "ID_INPUT"
  | "OTP_VERIFY"
  | "MAIN_MENU"
  | "MAIN_MENU_FPO"
  | "LIST_CROP"
  | "LIST_QUANTITY"
  | "LIST_QUALITY"
  | "LIST_PRICE"
  | "LIST_CONFIRM"
  | "OFFERS_LIST"
  | "PRICES_MENU"
  | "PRICES_SHOW"
  | "END";

export type IvrRole = "farmer" | "buyer" | "fpo";

export interface IvrSession {
  step: IvrStep;
  language: "en" | "hi" | "kn";
  role: IvrRole | null;
  krishilinkId: string | null;
  farmerId: string | null;      // profile.id of the authenticated user
  otpAttempts: number;
  draft: {
    crop?: string;
    quantityKg?: number;
    grade?: "A" | "B" | "C";
    pricePerKg?: number;
  };
}

export interface IvrOption {
  key: string;
  label: string;
  description?: string;
}

export interface IvrTurn {
  session: IvrSession;
  prompt: string;
  options?: IvrOption[];
  terminal?: boolean;
}

export const CROPS = [
  { key: "1", name: "Tomato" },
  { key: "2", name: "Onion" },
  { key: "3", name: "Potato" },
  { key: "4", name: "Wheat" },
  { key: "5", name: "Rice" },
];

export const NUMERIC_STEPS: IvrStep[] = [
  "ID_INPUT",
  "OTP_VERIFY",
  "LIST_QUANTITY",
  "LIST_PRICE",
];

export function isNumericStep(step: IvrStep): boolean {
  return NUMERIC_STEPS.includes(step);
}

/* ====================================================================== */
/*  Prompts — all three languages aligned                                  */
/* ====================================================================== */

const PROMPTS = {
  en: {
    welcome:
      "Welcome to KrishiLink — the bridge to fair prices. Press 1 for English, 2 for Hindi, 3 for Kannada.",
    roleSelect:
      "Who is calling? Press 1 for Farmer, 2 for Buyer, or 3 for FPO.",
    idInput:
      "Please enter your 6-digit KrishiLink ID. Type the digits and press hash to submit.",
    otpSending: "Sending a one-time code to your registered mobile…",
    otpVerify:
      "Please enter the 6-digit OTP we sent to your phone. Press hash when done.",
    otpWrong: "That code did not match. Please try again.",
    otpTooMany: "Too many wrong attempts. Please call back later.",
    mainMenuFarmer:
      "Farmer menu. Press 1 to list your crop, 2 to hear offers, 3 for today's mandi prices, 0 for an operator.",
    mainMenuFPO:
      "FPO menu. Press 1 to list a member's crop, 2 to hear group offers, 3 for today's mandi prices, 0 for an operator.",
    listCrop: "Which crop? Press 1 Tomato, 2 Onion, 3 Potato, 4 Wheat, 5 Rice.",
    listQuantity: "How many kilograms? Type the number and press hash.",
    listQuality: "What is the quality? Press 1 for Grade A, 2 for Grade B, 3 for Grade C.",
    listPrice: "What is your expected price per kilogram? Type it and press hash.",
    listConfirm:
      "Please confirm: {crop}, {qty} kilograms, Grade {grade}, expected {price} rupees per kilogram. Press 1 to confirm, 2 to cancel.",
    listingCreated: "Your crop is now listed. Buyers will see it shortly.",
    noOffers:
      "You have no pending offers right now. Press star to return to the main menu.",
    offersIntro:
      "You have {count} pending offers. I will read them from best net price.",
    offerRead:
      "Offer {n} of {total}. Buyer {buyer}. Price {price} rupees per kilogram. Quantity {qty} kilograms. Net realization {net} rupees per kilogram. Press 1 for next, 2 to accept, 3 to reject.",
    offersDone: "That was the last offer.",
    pricesIntro: "Today's mandi prices.",
    pricesDone: "Press star to return to the main menu.",
    accepted: "Offer accepted. The buyer will be notified. Thank you.",
    rejected: "Offer rejected.",
    buyerNotReady:
      "Buyer IVR is coming soon. Please use the KrishiLink web portal. Thank you.",
    unknown: "Sorry, I did not understand. Please try again.",
  },
  hi: {
    welcome:
      "कृषिलिंक में आपका स्वागत है। अंग्रेजी के लिए 1, हिंदी के लिए 2, कन्नड़ के लिए 3 दबाएं।",
    roleSelect:
      "कौन बोल रहे हैं? किसान के लिए 1, खरीदार के लिए 2, एफपीओ के लिए 3 दबाएं।",
    idInput:
      "कृपया अपनी 6 अंकों की कृषिलिंक आईडी दर्ज करें। अंक टाइप करें और हैश दबाएं।",
    otpSending: "आपके पंजीकृत मोबाइल पर कोड भेजा जा रहा है…",
    otpVerify:
      "कृपया अपने फोन पर भेजा गया 6 अंकों का OTP दर्ज करें। पूरा होने पर हैश दबाएं।",
    otpWrong: "कोड मेल नहीं खाया। कृपया पुनः प्रयास करें।",
    otpTooMany: "बहुत अधिक गलत प्रयास। कृपया बाद में कॉल करें।",
    mainMenuFarmer:
      "किसान मेन्यू। फसल सूचीबद्ध करने के लिए 1, ऑफर सुनने के लिए 2, आज के मंडी भाव के लिए 3, ऑपरेटर के लिए 0 दबाएं।",
    mainMenuFPO:
      "एफपीओ मेन्यू। सदस्य की फसल सूचीबद्ध करने के लिए 1, समूह के ऑफर सुनने के लिए 2, मंडी भाव के लिए 3, ऑपरेटर के लिए 0 दबाएं।",
    listCrop: "कौन सी फसल? 1 टमाटर, 2 प्याज, 3 आलू, 4 गेहूं, 5 चावल।",
    listQuantity: "कितने किलोग्राम? नंबर टाइप करें और हैश दबाएं।",
    listQuality: "गुणवत्ता क्या है? 1 ग्रेड A, 2 ग्रेड B, 3 ग्रेड C।",
    listPrice: "प्रति किलोग्राम अपेक्षित मूल्य? टाइप करें और हैश दबाएं।",
    listConfirm:
      "पुष्टि करें: {crop}, {qty} किलो, ग्रेड {grade}, अपेक्षित {price} रुपये प्रति किलो। पुष्टि के लिए 1, रद्द करने के लिए 2।",
    listingCreated: "आपकी फसल सूचीबद्ध हो गई है। धन्यवाद।",
    noOffers: "अभी कोई ऑफर नहीं है। मुख्य मेन्यू के लिए स्टार दबाएं।",
    offersIntro: "आपके {count} ऑफर हैं। मैं सबसे अच्छे शुद्ध मूल्य के अनुसार पढ़ूंगा।",
    offerRead:
      "ऑफर {n}/{total}। खरीदार {buyer}। कीमत {price} रुपये प्रति किलो। मात्रा {qty} किलो। शुद्ध लाभ {net} रुपये प्रति किलो। अगले के लिए 1, स्वीकार के लिए 2, अस्वीकार के लिए 3।",
    offersDone: "यह अंतिम ऑफर था।",
    pricesIntro: "आज के मंडी भाव।",
    pricesDone: "मुख्य मेन्यू के लिए स्टार दबाएं।",
    accepted: "ऑफर स्वीकार कर लिया गया। धन्यवाद।",
    rejected: "ऑफर अस्वीकार कर दिया गया।",
    buyerNotReady:
      "खरीदार IVR जल्द आ रहा है। कृपया वेब पोर्टल का उपयोग करें। धन्यवाद।",
    unknown: "क्षमा करें, समझ नहीं आया। पुनः प्रयास करें।",
  },
  kn: {
    welcome:
      "ಕೃಷಿಲಿಂಕ್‌ಗೆ ಸ್ವಾಗತ. ಇಂಗ್ಲಿಷ್‌ಗೆ 1, ಹಿಂದಿಗೆ 2, ಕನ್ನಡಕ್ಕೆ 3 ಒತ್ತಿರಿ.",
    roleSelect:
      "ಯಾರು ಕರೆ ಮಾಡುತ್ತಿದ್ದಾರೆ? ರೈತರಿಗೆ 1, ಖರೀದಿದಾರರಿಗೆ 2, ಎಫ್‌ಪಿಒಗೆ 3 ಒತ್ತಿರಿ.",
    idInput:
      "ನಿಮ್ಮ 6-ಅಂಕಿಯ ಕೃಷಿಲಿಂಕ್ ಐಡಿ ನಮೂದಿಸಿ. ಅಂಕಿ ಟೈಪ್ ಮಾಡಿ ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    otpSending: "ನಿಮ್ಮ ನೋಂದಾಯಿತ ಮೊಬೈಲ್‌ಗೆ ಕೋಡ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…",
    otpVerify: "ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಕಳುಹಿಸಿದ 6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ. ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    otpWrong: "ಕೋಡ್ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    otpTooMany: "ಹಲವು ತಪ್ಪು ಪ್ರಯತ್ನಗಳು. ನಂತರ ಕರೆ ಮಾಡಿ.",
    mainMenuFarmer:
      "ರೈತ ಮೆನು. ಬೆಳೆ ಪಟ್ಟಿಗೆ 1, ಆಫರ್‌ಗಳಿಗೆ 2, ಮಂಡಿ ದರಗಳಿಗೆ 3, ಆಪರೇಟರ್‌ಗೆ 0 ಒತ್ತಿರಿ.",
    mainMenuFPO:
      "ಎಫ್‌ಪಿಒ ಮೆನು. ಸದಸ್ಯರ ಬೆಳೆ ಪಟ್ಟಿಗೆ 1, ಗುಂಪು ಆಫರ್‌ಗಳಿಗೆ 2, ಮಂಡಿ ದರಗಳಿಗೆ 3, ಆಪರೇಟರ್‌ಗೆ 0 ಒತ್ತಿರಿ.",
    listCrop: "ಯಾವ ಬೆಳೆ? 1 ಟೊಮೆಟೊ, 2 ಈರುಳ್ಳಿ, 3 ಆಲೂಗಡ್ಡೆ, 4 ಗೋಧಿ, 5 ಅಕ್ಕಿ.",
    listQuantity: "ಎಷ್ಟು ಕಿಲೋ? ಸಂಖ್ಯೆ ಟೈಪ್ ಮಾಡಿ ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    listQuality: "ಗುಣಮಟ್ಟ? 1 ಗ್ರೇಡ್ A, 2 ಗ್ರೇಡ್ B, 3 ಗ್ರೇಡ್ C.",
    listPrice: "ಪ್ರತಿ ಕಿಲೋ ಬೆಲೆ? ಟೈಪ್ ಮಾಡಿ ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    listConfirm:
      "ಖಚಿತಪಡಿಸಿ: {crop}, {qty} ಕಿಲೋ, ಗ್ರೇಡ್ {grade}, ಬೆಲೆ {price} ರೂ. 1 = ಖಚಿತ, 2 = ರದ್ದು.",
    listingCreated: "ನಿಮ್ಮ ಬೆಳೆ ಪಟ್ಟಿಯಾಗಿದೆ. ಧನ್ಯವಾದ.",
    noOffers: "ಈಗ ಯಾವುದೇ ಆಫರ್ ಇಲ್ಲ. ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    offersIntro: "ನಿಮಗೆ {count} ಆಫರ್‌ಗಳಿವೆ.",
    offerRead:
      "ಆಫರ್ {n}/{total}. ಖರೀದಿದಾರ {buyer}. ಬೆಲೆ {price} ರೂ. ಪ್ರಮಾಣ {qty} ಕಿಲೋ. ನಿವ್ವಳ {net} ರೂ. ಮುಂದೆ 1, ಸ್ವೀಕರಿಸಲು 2, ತಿರಸ್ಕರಿಸಲು 3.",
    offersDone: "ಇದು ಕೊನೆಯ ಆಫರ್.",
    pricesIntro: "ಇಂದಿನ ಮಂಡಿ ದರಗಳು.",
    pricesDone: "ಮುಖ್ಯ ಮೆನುಗೆ ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    accepted: "ಆಫರ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದ.",
    rejected: "ಆಫರ್ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ.",
    buyerNotReady: "ಖರೀದಿದಾರ IVR ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ. ವೆಬ್ ಪೋರ್ಟಲ್ ಬಳಸಿ.",
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

export function startSession(): IvrTurn {
  const session: IvrSession = {
    step: "WELCOME",
    language: "en",
    role: null,
    krishilinkId: null,
    farmerId: null,
    otpAttempts: 0,
    draft: {},
  };
  return { session, prompt: PROMPTS.en.welcome };
}

/* ====================================================================== */
/*  Structured options per step                                            */
/* ====================================================================== */

export function optionsForStep(
  step: IvrStep,
  lang: "en" | "hi" | "kn"
): IvrOption[] | undefined {
  const L = (en: string, hi: string, kn: string) =>
    lang === "hi" ? hi : lang === "kn" ? kn : en;

  switch (step) {
    case "WELCOME":
      return [
        { key: "1", label: "English" },
        { key: "2", label: "हिन्दी", description: "Hindi" },
        { key: "3", label: "ಕನ್ನಡ", description: "Kannada" },
      ];
    case "ROLE_SELECT":
      return [
        {
          key: "1",
          label: L("Farmer", "किसान", "ರೈತ"),
          description: L("Individual farmer", "व्यक्तिगत किसान", "ವೈಯಕ್ತಿಕ"),
        },
        {
          key: "2",
          label: L("Buyer", "खरीदार", "ಖರೀದಿದಾರ"),
          description: L("Buyer or FPO procurement", "खरीदार / खरीद", "ಖರೀದಿ"),
        },
        {
          key: "3",
          label: L("FPO", "एफपीओ", "ಎಫ್‌ಪಿಒ"),
          description: L(
            "Farmer Producer Organisation",
            "किसान उत्पादक संगठन",
            "ರೈತ ಉತ್ಪಾದಕ ಸಂಸ್ಥೆ"
          ),
        },
      ];
    case "MAIN_MENU":
      return [
        {
          key: "1",
          label: L("List my crop", "फसल सूचीबद्ध करें", "ಬೆಳೆ ಪಟ್ಟಿ ಮಾಡಿ"),
        },
        {
          key: "2",
          label: L("Hear offers", "ऑफर सुनें", "ಆಫರ್ ಕೇಳಿ"),
        },
        {
          key: "3",
          label: L(
            "Today's mandi prices",
            "आज के मंडी भाव",
            "ಇಂದಿನ ಮಂಡಿ ದರ"
          ),
        },
        {
          key: "0",
          label: L(
            "Talk to an operator",
            "ऑपरेटर से बात करें",
            "ಆಪರೇಟರ್"
          ),
        },
      ];
    case "MAIN_MENU_FPO":
      return [
        {
          key: "1",
          label: L(
            "List a member's crop",
            "सदस्य की फसल सूचीबद्ध करें",
            "ಸದಸ್ಯರ ಬೆಳೆ ಪಟ್ಟಿ"
          ),
        },
        {
          key: "2",
          label: L("Hear group offers", "समूह ऑफर सुनें", "ಗುಂಪು ಆಫರ್"),
        },
        {
          key: "3",
          label: L(
            "Today's mandi prices",
            "आज के मंडी भाव",
            "ಇಂದಿನ ಮಂಡಿ ದರ"
          ),
        },
        {
          key: "0",
          label: L(
            "Talk to an operator",
            "ऑपरेटर से बात करें",
            "ಆಪರೇಟರ್"
          ),
        },
      ];
    case "LIST_CROP":
      return CROPS.map((c) => ({ key: c.key, label: c.name }));
    case "LIST_QUALITY":
      return [
        {
          key: "1",
          label: "Grade A",
          description: L("Premium", "प्रीमियम", "ಪ್ರೀಮಿಯಂ"),
        },
        {
          key: "2",
          label: "Grade B",
          description: L("Standard", "मानक", "ಪ್ರಮಾಣಿತ"),
        },
        {
          key: "3",
          label: "Grade C",
          description: L("Economy", "किफायती", "ಆರ್ಥಿಕ"),
        },
      ];
    case "LIST_CONFIRM":
      return [
        { key: "1", label: L("Confirm", "पुष्टि करें", "ಖಚಿತಪಡಿಸಿ") },
        { key: "2", label: L("Cancel", "रद्द करें", "ರದ್ದುಮಾಡಿ") },
      ];
    default:
      return undefined;
  }
}

/* ====================================================================== */
/*  Advance state machine                                                  */
/* ====================================================================== */

export function advance(
  session: IvrSession,
  input: string,
  extras?: { farmerId?: string; otpVerified?: boolean }
): IvrTurn {
  const lang = session.language;

  switch (session.step) {
    case "WELCOME": {
      if (input === "1") session.language = "en";
      else if (input === "2") session.language = "hi";
      else if (input === "3") session.language = "kn";
      else return { session, prompt: PROMPTS[lang].unknown };
      session.step = "ROLE_SELECT";
      return {
        session,
        prompt: PROMPTS[session.language].roleSelect,
        options: optionsForStep("ROLE_SELECT", session.language),
      };
    }

    case "ROLE_SELECT": {
      if (input === "1") {
        session.role = "farmer";
        session.step = "ID_INPUT";
        return {
          session,
          prompt: PROMPTS[lang].idInput,
        };
      }
      if (input === "2") {
        session.role = "buyer";
        session.step = "END";
        return {
          session,
          prompt: PROMPTS[lang].buyerNotReady,
          terminal: true,
        };
      }
      if (input === "3") {
        session.role = "fpo";
        session.step = "ID_INPUT";
        return {
          session,
          prompt: PROMPTS[lang].idInput,
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    case "ID_INPUT": {
      const clean = input.replace(/[^0-9]/g, "");
      if (clean.length !== 6) {
        return { session, prompt: PROMPTS[lang].idInput };
      }
      session.krishilinkId = `KL-${clean}`;
      session.step = "OTP_VERIFY";
      return { session, prompt: PROMPTS[lang].otpSending };
    }

    case "OTP_VERIFY": {
      if (extras?.otpVerified && extras.farmerId) {
        session.farmerId = extras.farmerId;
        session.step = session.role === "fpo" ? "MAIN_MENU_FPO" : "MAIN_MENU";
        const key =
          session.role === "fpo" ? "mainMenuFPO" : "mainMenuFarmer";
        return {
          session,
          prompt: PROMPTS[lang][key],
          options: optionsForStep(session.step, lang),
        };
      }
      session.otpAttempts += 1;
      if (session.otpAttempts >= 3) {
        session.step = "END";
        return { session, prompt: PROMPTS[lang].otpTooMany, terminal: true };
      }
      return { session, prompt: PROMPTS[lang].otpWrong };
    }

    case "MAIN_MENU":
    case "MAIN_MENU_FPO": {
      const menuStep = session.step;
      if (input === "1") {
        session.step = "LIST_CROP";
        return {
          session,
          prompt: PROMPTS[lang].listCrop,
          options: optionsForStep("LIST_CROP", lang),
        };
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
      return {
        session,
        prompt: PROMPTS[lang].unknown,
        options: optionsForStep(menuStep, lang),
      };
    }

    case "LIST_CROP": {
      const crop = CROPS.find((c) => c.key === input);
      if (!crop) {
        return {
          session,
          prompt: PROMPTS[lang].listCrop,
          options: optionsForStep("LIST_CROP", lang),
        };
      }
      session.draft.crop = crop.name;
      session.step = "LIST_QUANTITY";
      return { session, prompt: PROMPTS[lang].listQuantity };
    }

    case "LIST_QUANTITY": {
      const clean = input.replace(/[#*]/g, "");
      const qty = Number(clean);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { session, prompt: PROMPTS[lang].listQuantity };
      }
      session.draft.quantityKg = qty;
      session.step = "LIST_QUALITY";
      return {
        session,
        prompt: PROMPTS[lang].listQuality,
        options: optionsForStep("LIST_QUALITY", lang),
      };
    }

    case "LIST_QUALITY": {
      const map: Record<string, "A" | "B" | "C"> = {
        "1": "A",
        "2": "B",
        "3": "C",
      };
      const grade = map[input];
      if (!grade) {
        return {
          session,
          prompt: PROMPTS[lang].listQuality,
          options: optionsForStep("LIST_QUALITY", lang),
        };
      }
      session.draft.grade = grade;
      session.step = "LIST_PRICE";
      return { session, prompt: PROMPTS[lang].listPrice };
    }

    case "LIST_PRICE": {
      const clean = input.replace(/[#*]/g, "");
      const price = Number(clean);
      if (!Number.isFinite(price) || price <= 0) {
        return { session, prompt: PROMPTS[lang].listPrice };
      }
      session.draft.pricePerKg = price;
      session.step = "LIST_CONFIRM";
      const confirm = t("listConfirm", lang, {
        crop: session.draft.crop ?? "",
        qty: session.draft.quantityKg ?? 0,
        grade: session.draft.grade ?? "",
        price: session.draft.pricePerKg ?? 0,
      });
      return {
        session,
        prompt: confirm,
        options: optionsForStep("LIST_CONFIRM", lang),
      };
    }

    case "LIST_CONFIRM": {
      if (input === "1") {
        return { session, prompt: "Saving your listing…" };
      }
      if (input === "2") {
        session.draft = {};
        session.step = session.role === "fpo" ? "MAIN_MENU_FPO" : "MAIN_MENU";
        const key = session.role === "fpo" ? "mainMenuFPO" : "mainMenuFarmer";
        return {
          session,
          prompt: PROMPTS[lang][key],
          options: optionsForStep(session.step, lang),
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    case "OFFERS_LIST":
    case "PRICES_SHOW": {
      if (input === "*") {
        session.step = session.role === "fpo" ? "MAIN_MENU_FPO" : "MAIN_MENU";
        const key = session.role === "fpo" ? "mainMenuFPO" : "mainMenuFarmer";
        return {
          session,
          prompt: PROMPTS[lang][key],
          options: optionsForStep(session.step, lang),
        };
      }
      return { session, prompt: "Processing…" };
    }

    case "PRICES_MENU": {
      if (input === "*") {
        session.step = session.role === "fpo" ? "MAIN_MENU_FPO" : "MAIN_MENU";
        const key = session.role === "fpo" ? "mainMenuFPO" : "mainMenuFarmer";
        return {
          session,
          prompt: PROMPTS[lang][key],
          options: optionsForStep(session.step, lang),
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    default:
      return { session, prompt: PROMPTS[lang].unknown, terminal: true };
  }
}