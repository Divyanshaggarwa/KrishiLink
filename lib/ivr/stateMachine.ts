/* ========================================================================
   KrishiLink IVR State Machine — v5 with Buyer flow
   ======================================================================== */

export type IvrStep =
  | "WELCOME"
  | "LANGUAGE"
  | "ROLE_SELECT"
  | "ID_INPUT"
  | "OTP_VERIFY"
  | "MAIN_MENU"
  | "MAIN_MENU_FPO"
  | "MAIN_MENU_BUYER"
  | "LIST_CROP"
  | "LIST_QUANTITY"
  | "LIST_QUALITY"
  | "LIST_PRICE"
  | "LIST_CONFIRM"
  | "FPO_CONTRIB_MEMBER"
  | "FPO_CONTRIB_CONFIRM"
  | "BUYER_CROP_SELECT"
  | "BUYER_LISTING_LIST"
  | "BUYER_OFFER_QTY"
  | "BUYER_OFFER_PRICE"
  | "BUYER_OFFER_CONFIRM"
  | "BUYER_BIDS_VIEW"
  | "BUYER_ORDERS_VIEW"
  | "OFFERS_LIST"
  | "PRICES_MENU"
  | "PRICES_SHOW"
  | "END";

export type IvrRole = "farmer" | "buyer" | "fpo";

export interface FpoMember {
  id: string;
  name: string;
  krishilink_id: string;
}

export interface FpoContribution {
  memberId: string;
  memberName: string;
  quantityKg: number;
}

export interface IvrSession {
  step: IvrStep;
  language: "en" | "hi" | "kn";
  role: IvrRole | null;
  krishilinkId: string | null;
  farmerId: string | null;
  otpAttempts: number;
  fpoMembers: FpoMember[];
  draft: {
    crop?: string;
    quantityKg?: number;
    grade?: "A" | "B" | "C";
    pricePerKg?: number;
    contributions?: FpoContribution[];
    memberIdx?: number;
    buyerListingId?: string;
    buyerListingCrop?: string;
    buyerListingPrice?: number;
    buyerOfferQty?: number;
    buyerOfferPrice?: number;
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
  "FPO_CONTRIB_MEMBER",
  "BUYER_OFFER_QTY",
  "BUYER_OFFER_PRICE",
];

export function isNumericStep(step: IvrStep): boolean {
  return NUMERIC_STEPS.includes(step);
}

/* ====================================================================== */
/*  Prompts                                                               */
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
    otpVerify: "Please enter the 6-digit OTP. Press hash when done.",
    otpWrong: "That code did not match. Please try again.",
    otpTooMany: "Too many wrong attempts. Please call back later.",
    mainMenuFarmer:
      "Farmer menu. Press 1 to list your crop, 2 to hear offers, 3 for today's mandi prices, 0 for an operator.",
    mainMenuFPO:
      "FPO menu. Press 1 to create a pooled listing, 2 to hear group offers, 3 for today's mandi prices, 0 for an operator.",
    mainMenuBuyer:
      "Buyer menu. Press 1 to browse crops, 2 to hear your bids, 3 to check your orders, 0 for an operator.",
    listCrop:
      "Which crop? Press 1 Tomato, 2 Onion, 3 Potato, 4 Wheat, 5 Rice.",
    listQuantity: "How many kilograms? Type the number and press hash.",
    listQuality:
      "What is the quality? Press 1 for Grade A, 2 for Grade B, 3 for Grade C.",
    listPrice:
      "What is your expected price per kilogram? Type it and press hash.",
    listConfirm:
      "Please confirm: {crop}, {qty} kilograms, Grade {grade}, expected {price} rupees per kilogram. Press 1 to confirm, 2 to cancel.",
    fpoContribIntro:
      "Now let's record each member's contribution. Starting with member {n} of {total}: {name}.",
    fpoContribAsk:
      "How many kilograms is {name} contributing? Type the number and press hash.",
    fpoContribHeadAsk:
      "How many kilograms are you, the FPO head, contributing? Type the number and press hash.",
    fpoContribSummary:
      "You have recorded contributions totalling {sum} of {total} kilograms. Press 1 to confirm and create the pool, or 2 to cancel.",
    fpoContribMismatch:
      "Contributions must equal the total pool quantity. Please continue entering member quantities.",
    listingCreated:
      "Your crop is now listed on your farm account. Thank you.",
    poolCreated:
      "Your FPO pool is now active. Buyers can see it and revenue will split by contribution.",
    noOffers:
      "You have no pending offers right now. Press star to return to the main menu.",
    offersIntro:
      "You have {count} pending offers. I will read them from best net price.",
    offerRead:
      "Offer {n} of {total}. Buyer {buyer}. Price {price} rupees per kilogram. Quantity {qty} kilograms. Net realization {net} rupees per kilogram. Press 1 for next, 2 to accept, 3 to reject.",
    offersDone: "That was the last offer.",
    buyerCropSelect:
      "Which crop are you looking for? Press 1 Tomato, 2 Onion, 3 Potato, 4 Wheat, 5 Rice.",
    buyerNoListings:
      "No active listings for this crop right now. Press star to return to the main menu.",
    buyerListingList:
      "I found {count} listings. I will read the top three by farmer price.",
    buyerListingRead:
      "Listing {n}. {crop}, Grade {grade}, from {district}. Farmer asking {price} rupees per kilogram. Available {qty} kilograms. Press {key} to bid on this listing, or press 1 for the next.",
    buyerNoMoreListings: "That was the last listing.",
    buyerOfferQtyAsk:
      "You are bidding on {crop} at {price} rupees per kilogram. How many kilograms do you want? Type the number and press hash.",
    buyerOfferPriceAsk:
      "What is your offer price per kilogram? Type the number and press hash.",
    buyerOfferConfirm:
      "Confirm offer: {qty} kilograms of {crop} at {price} rupees per kilogram. Total {total} rupees. Press 1 to place this offer, 2 to cancel.",
    buyerOfferPlaced:
      "Your offer has been placed. The farmer will see it shortly and can accept or reject. Thank you.",
    buyerNoBids:
      "You have no bids yet. Press star to return to the main menu.",
    buyerBidsIntro:
      "You have {count} bids. I will read them in order of most recent.",
    buyerBidRead:
      "Bid {n} of {total}. {crop}. Your offer {price} rupees per kilogram for {qty} kilograms. Status: {status}.",
    buyerBidsDone: "That was your last bid.",
    buyerNoOrders:
      "You have no orders yet. Press star to return to the main menu.",
    buyerOrdersIntro: "You have {count} orders.",
    buyerOrderRead:
      "Order {n} of {total}. {crop}. Total {total_amt} rupees. Status: {status}.",
    buyerOrdersDone: "That was your last order.",
    pricesIntro: "Today's mandi prices.",
    pricesDone: "Press star to return to the main menu.",
    accepted: "Offer accepted. The buyer will be notified.",
    rejected: "Offer rejected.",
    unknown: "Sorry, I did not understand. Please try again.",
  },
  hi: {
    welcome:
      "कृषिलिंक में आपका स्वागत है। अंग्रेजी के लिए 1, हिंदी के लिए 2, कन्नड़ के लिए 3 दबाएं।",
    roleSelect: "कौन बोल रहे हैं? किसान 1, खरीदार 2, एफपीओ 3।",
    idInput: "कृपया 6 अंकों की कृषिलिंक आईडी दर्ज करें। हैश दबाएं।",
    otpSending: "आपके मोबाइल पर कोड भेजा जा रहा है…",
    otpVerify: "6 अंकों का OTP दर्ज करें। हैश दबाएं।",
    otpWrong: "कोड मेल नहीं खाया। पुनः प्रयास करें।",
    otpTooMany: "बहुत अधिक गलत प्रयास। बाद में कॉल करें।",
    mainMenuFarmer: "किसान मेन्यू। 1 फसल, 2 ऑफर, 3 मंडी भाव, 0 ऑपरेटर।",
    mainMenuFPO:
      "एफपीओ मेन्यू। 1 पूल बनाएं, 2 समूह ऑफर, 3 मंडी भाव, 0 ऑपरेटर।",
    mainMenuBuyer:
      "खरीदार मेन्यू। 1 फसल देखें, 2 मेरी बोलियां, 3 मेरे ऑर्डर, 0 ऑपरेटर।",
    listCrop: "कौन सी फसल? 1 टमाटर, 2 प्याज, 3 आलू, 4 गेहूं, 5 चावल।",
    listQuantity: "कितने किलोग्राम? नंबर टाइप करें और हैश दबाएं।",
    listQuality: "गुणवत्ता? 1 ग्रेड A, 2 ग्रेड B, 3 ग्रेड C।",
    listPrice: "प्रति किलोग्राम अपेक्षित मूल्य? टाइप करें और हैश दबाएं।",
    listConfirm:
      "पुष्टि करें: {crop}, {qty} किलो, ग्रेड {grade}, {price} रुपये प्रति किलो। पुष्टि के लिए 1, रद्द के लिए 2।",
    fpoContribIntro:
      "अब प्रत्येक सदस्य का योगदान दर्ज करें। सदस्य {n}/{total}: {name}।",
    fpoContribAsk: "{name} कितने किलोग्राम दे रहे हैं? हैश दबाएं।",
    fpoContribHeadAsk:
      "आप, एफपीओ प्रमुख, कितने किलोग्राम दे रहे हैं? हैश दबाएं।",
    fpoContribSummary:
      "कुल {sum}/{total} किलोग्राम दर्ज। पूल बनाने के लिए 1, रद्द करने के लिए 2।",
    fpoContribMismatch: "योगदान कुल मात्रा के बराबर होना चाहिए।",
    listingCreated: "आपकी फसल सूचीबद्ध हो गई है। धन्यवाद।",
    poolCreated:
      "आपका एफपीओ पूल सक्रिय है। राजस्व योगदान के अनुसार विभाजित होगा।",
    noOffers: "कोई ऑफर नहीं है। स्टार दबाएं।",
    offersIntro: "आपके {count} ऑफर हैं। मैं शुद्ध मूल्य के अनुसार पढ़ूंगा।",
    offerRead:
      "ऑफर {n}/{total}। खरीदार {buyer}। कीमत {price} रुपये/किलो। मात्रा {qty} किलो। शुद्ध {net} रुपये/किलो। 1 अगला, 2 स्वीकार, 3 अस्वीकार।",
    offersDone: "अंतिम ऑफर।",
    buyerCropSelect: "कौन सी फसल? 1 टमाटर, 2 प्याज, 3 आलू, 4 गेहूं, 5 चावल।",
    buyerNoListings: "इस फसल के लिए कोई लिस्टिंग नहीं। स्टार दबाएं।",
    buyerListingList: "मुझे {count} लिस्टिंग मिलीं। शीर्ष तीन पढ़ता हूं।",
    buyerListingRead:
      "लिस्टिंग {n}। {crop}, ग्रेड {grade}, {district}। बेल {price} रुपये/किलो। उपलब्ध {qty} किलो। बोली लगाने के लिए {key} दबाएं, अगले के लिए 1।",
    buyerNoMoreListings: "यह अंतिम लिस्टिंग थी।",
    buyerOfferQtyAsk:
      "{crop} पर {price} रुपये/किलो बोली। कितने किलो चाहिए? हैश दबाएं।",
    buyerOfferPriceAsk: "आपकी बोली मूल्य प्रति किलो? हैश दबाएं।",
    buyerOfferConfirm:
      "पुष्टि: {qty} किलो {crop} पर {price} रुपये/किलो। कुल {total} रुपये। 1 पुष्टि, 2 रद्द।",
    buyerOfferPlaced: "आपकी बोली लग गई। किसान को सूचित किया जाएगा।",
    buyerNoBids: "कोई बोली नहीं है। स्टार दबाएं।",
    buyerBidsIntro: "आपकी {count} बोलियां हैं।",
    buyerBidRead:
      "बोली {n}/{total}। {crop}। आपकी बोली {price} रुपये/किलो, {qty} किलो। स्थिति: {status}।",
    buyerBidsDone: "अंतिम बोली।",
    buyerNoOrders: "कोई ऑर्डर नहीं है। स्टार दबाएं।",
    buyerOrdersIntro: "आपके {count} ऑर्डर हैं।",
    buyerOrderRead:
      "ऑर्डर {n}/{total}। {crop}। कुल {total_amt} रुपये। स्थिति: {status}।",
    buyerOrdersDone: "अंतिम ऑर्डर।",
    pricesIntro: "आज के मंडी भाव।",
    pricesDone: "मुख्य मेन्यू के लिए स्टार दबाएं।",
    accepted: "ऑफर स्वीकार किया गया।",
    rejected: "ऑफर अस्वीकार किया गया।",
    unknown: "क्षमा करें, समझ नहीं आया।",
  },
  kn: {
    welcome:
      "ಕೃಷಿಲಿಂಕ್‌ಗೆ ಸ್ವಾಗತ. ಇಂಗ್ಲಿಷ್‌ಗೆ 1, ಹಿಂದಿಗೆ 2, ಕನ್ನಡಕ್ಕೆ 3 ಒತ್ತಿರಿ.",
    roleSelect: "ಯಾರು ಕರೆ ಮಾಡುತ್ತಿದ್ದಾರೆ? ರೈತ 1, ಖರೀದಿದಾರ 2, ಎಫ್‌ಪಿಒ 3.",
    idInput: "6-ಅಂಕಿಯ ಕೃಷಿಲಿಂಕ್ ಐಡಿ ನಮೂದಿಸಿ. ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    otpSending: "ನಿಮ್ಮ ಮೊಬೈಲ್‌ಗೆ ಕೋಡ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…",
    otpVerify: "6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ. ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    otpWrong: "ಕೋಡ್ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    otpTooMany: "ಹಲವು ತಪ್ಪು ಪ್ರಯತ್ನ. ನಂತರ ಕರೆ ಮಾಡಿ.",
    mainMenuFarmer: "ರೈತ ಮೆನು. 1 ಬೆಳೆ, 2 ಆಫರ್, 3 ಮಂಡಿ ದರ, 0 ಆಪರೇಟರ್.",
    mainMenuFPO:
      "ಎಫ್‌ಪಿಒ ಮೆನು. 1 ಪೂಲ್ ರಚಿಸಿ, 2 ಗುಂಪು ಆಫರ್, 3 ಮಂಡಿ ದರ, 0 ಆಪರೇಟರ್.",
    mainMenuBuyer:
      "ಖರೀದಿದಾರ ಮೆನು. 1 ಬೆಳೆ ನೋಡಿ, 2 ನನ್ನ ಬಿಡ್‌ಗಳು, 3 ಆರ್ಡರ್, 0 ಆಪರೇಟರ್.",
    listCrop: "ಯಾವ ಬೆಳೆ? 1 ಟೊಮೆಟೊ, 2 ಈರುಳ್ಳಿ, 3 ಆಲೂಗಡ್ಡೆ, 4 ಗೋಧಿ, 5 ಅಕ್ಕಿ.",
    listQuantity: "ಎಷ್ಟು ಕಿಲೋ? ಸಂಖ್ಯೆ ಟೈಪ್ ಮಾಡಿ ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    listQuality: "ಗುಣಮಟ್ಟ? 1 ಗ್ರೇಡ್ A, 2 ಗ್ರೇಡ್ B, 3 ಗ್ರೇಡ್ C.",
    listPrice: "ಪ್ರತಿ ಕಿಲೋ ಬೆಲೆ? ಟೈಪ್ ಮಾಡಿ ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    listConfirm:
      "ಖಚಿತಪಡಿಸಿ: {crop}, {qty} ಕಿಲೋ, ಗ್ರೇಡ್ {grade}, {price} ರೂ. 1 = ಖಚಿತ, 2 = ರದ್ದು.",
    fpoContribIntro:
      "ಈಗ ಪ್ರತಿ ಸದಸ್ಯರ ಕೊಡುಗೆ ದಾಖಲಿಸುತ್ತೇವೆ. ಸದಸ್ಯ {n}/{total}: {name}.",
    fpoContribAsk: "{name} ಎಷ್ಟು ಕಿಲೋ ಕೊಡುತ್ತಿದ್ದಾರೆ? ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    fpoContribHeadAsk:
      "ನೀವು, ಎಫ್‌ಪಿಒ ಮುಖ್ಯಸ್ಥರು, ಎಷ್ಟು ಕಿಲೋ ಕೊಡುತ್ತಿದ್ದೀರಿ? ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    fpoContribSummary:
      "{sum}/{total} ಕಿಲೋ ದಾಖಲಾಗಿದೆ. ಪೂಲ್ ರಚಿಸಲು 1, ರದ್ದುಗೊಳಿಸಲು 2.",
    fpoContribMismatch: "ಕೊಡುಗೆಗಳು ಒಟ್ಟು ಪ್ರಮಾಣಕ್ಕೆ ಸಮನಾಗಿರಬೇಕು.",
    listingCreated: "ನಿಮ್ಮ ಬೆಳೆ ಪಟ್ಟಿಯಾಗಿದೆ. ಧನ್ಯವಾದ.",
    poolCreated:
      "ನಿಮ್ಮ ಎಫ್‌ಪಿಒ ಪೂಲ್ ಸಕ್ರಿಯವಾಗಿದೆ. ಆದಾಯ ಕೊಡುಗೆ ಪ್ರಕಾರ ವಿಭಜನೆಯಾಗುತ್ತದೆ.",
    noOffers: "ಯಾವುದೇ ಆಫರ್ ಇಲ್ಲ. ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    offersIntro: "ನಿಮಗೆ {count} ಆಫರ್‌ಗಳಿವೆ.",
    offerRead:
      "ಆಫರ್ {n}/{total}. ಖರೀದಿದಾರ {buyer}. ಬೆಲೆ {price} ರೂ./ಕಿಲೋ. ಪ್ರಮಾಣ {qty} ಕಿಲೋ. ನಿವ್ವಳ {net} ರೂ./ಕಿಲೋ. 1 ಮುಂದೆ, 2 ಸ್ವೀಕರಿಸಿ, 3 ತಿರಸ್ಕರಿಸಿ.",
    offersDone: "ಕೊನೆಯ ಆಫರ್.",
    buyerCropSelect: "ಯಾವ ಬೆಳೆ? 1 ಟೊಮೆಟೊ, 2 ಈರುಳ್ಳಿ, 3 ಆಲೂಗಡ್ಡೆ, 4 ಗೋಧಿ, 5 ಅಕ್ಕಿ.",
    buyerNoListings: "ಈ ಬೆಳೆಗೆ ಯಾವುದೇ ಪಟ್ಟಿ ಇಲ್ಲ. ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    buyerListingList: "{count} ಪಟ್ಟಿಗಳು ಸಿಕ್ಕಿವೆ. ಮೊದಲ ಮೂರು ಓದುತ್ತೇನೆ.",
    buyerListingRead:
      "ಪಟ್ಟಿ {n}. {crop}, ಗ್ರೇಡ್ {grade}, {district}. ಬೆಲೆ {price} ರೂ./ಕಿಲೋ. ಲಭ್ಯವಿದೆ {qty} ಕಿಲೋ. ಬಿಡ್‌ಗೆ {key} ಒತ್ತಿರಿ, ಮುಂದೆ 1.",
    buyerNoMoreListings: "ಇದು ಕೊನೆಯ ಪಟ್ಟಿ.",
    buyerOfferQtyAsk:
      "{crop} ಗೆ {price} ರೂ. ಬಿಡ್. ಎಷ್ಟು ಕಿಲೋ ಬೇಕು? ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    buyerOfferPriceAsk: "ನಿಮ್ಮ ಬಿಡ್ ಬೆಲೆ ಪ್ರತಿ ಕಿಲೋ? ಹ್ಯಾಶ್ ಒತ್ತಿರಿ.",
    buyerOfferConfirm:
      "ಖಚಿತ: {qty} ಕಿಲೋ {crop} ಬೆಲೆ {price} ರೂ. ಒಟ್ಟು {total} ರೂ. 1 = ಖಚಿತ, 2 = ರದ್ದು.",
    buyerOfferPlaced: "ನಿಮ್ಮ ಬಿಡ್ ಸಲ್ಲಿಸಲಾಗಿದೆ. ರೈತರಿಗೆ ತಿಳಿಸಲಾಗುವುದು.",
    buyerNoBids: "ಯಾವುದೇ ಬಿಡ್ ಇಲ್ಲ. ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    buyerBidsIntro: "ನಿಮ್ಮ {count} ಬಿಡ್‌ಗಳು.",
    buyerBidRead:
      "ಬಿಡ್ {n}/{total}. {crop}. ನಿಮ್ಮ ಬಿಡ್ {price} ರೂ./ಕಿಲೋ, {qty} ಕಿಲೋ. ಸ್ಥಿತಿ: {status}.",
    buyerBidsDone: "ಕೊನೆಯ ಬಿಡ್.",
    buyerNoOrders: "ಆರ್ಡರ್ ಇಲ್ಲ. ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    buyerOrdersIntro: "ನಿಮ್ಮ {count} ಆರ್ಡರ್‌ಗಳು.",
    buyerOrderRead:
      "ಆರ್ಡರ್ {n}/{total}. {crop}. ಒಟ್ಟು {total_amt} ರೂ. ಸ್ಥಿತಿ: {status}.",
    buyerOrdersDone: "ಕೊನೆಯ ಆರ್ಡರ್.",
    pricesIntro: "ಇಂದಿನ ಮಂಡಿ ದರಗಳು.",
    pricesDone: "ಮುಖ್ಯ ಮೆನುಗೆ ಸ್ಟಾರ್ ಒತ್ತಿರಿ.",
    accepted: "ಆಫರ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ.",
    rejected: "ಆಫರ್ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ.",
    unknown: "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ.",
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
    fpoMembers: [],
    draft: {},
  };
  return { session, prompt: PROMPTS.en.welcome };
}

/* ====================================================================== */
/*  Options per step                                                      */
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
          description: L("Sell your crops", "फसल बेचें", "ಬೆಳೆ ಮಾರಾಟ"),
        },
        {
          key: "2",
          label: L("Buyer", "खरीदार", "ಖರೀದಿದಾರ"),
          description: L("Buy crops", "फसल खरीदें", "ಬೆಳೆ ಖರೀದಿ"),
        },
        {
          key: "3",
          label: L("FPO", "एफपीओ", "ಎಫ್‌ಪಿಒ"),
          description: L("Pool & sell collectively", "सामूहिक बिक्री", "ಸಾಮೂಹಿಕ ಮಾರಾಟ"),
        },
      ];
    case "MAIN_MENU":
      return [
        { key: "1", label: L("List my crop", "फसल सूचीबद्ध करें", "ಬೆಳೆ ಪಟ್ಟಿ") },
        { key: "2", label: L("Hear offers", "ऑफर सुनें", "ಆಫರ್ ಕೇಳಿ") },
        { key: "3", label: L("Today's mandi prices", "आज के मंडी भाव", "ಇಂದಿನ ಮಂಡಿ ದರ") },
        { key: "0", label: L("Talk to an operator", "ऑपरेटर से बात करें", "ಆಪರೇಟರ್") },
      ];
    case "MAIN_MENU_FPO":
      return [
        { key: "1", label: L("List a member's crop", "सदस्य की फसल", "ಸದಸ್ಯರ ಬೆಳೆ") },
        { key: "2", label: L("Hear group offers", "समूह ऑफर सुनें", "ಗುಂಪು ಆಫರ್") },
        { key: "3", label: L("Today's mandi prices", "आज के मंडी भाव", "ಇಂದಿನ ಮಂಡಿ ದರ") },
        { key: "0", label: L("Talk to an operator", "ऑपरेटर से बात करें", "ಆಪರೇಟರ್") },
      ];
    case "MAIN_MENU_BUYER":
      return [
        { key: "1", label: L("Browse crops", "फसल देखें", "ಬೆಳೆ ನೋಡಿ") },
        { key: "2", label: L("Hear my bids", "मेरी बोलियां", "ನನ್ನ ಬಿಡ್") },
        { key: "3", label: L("Check my orders", "मेरे ऑर्डर", "ನನ್ನ ಆರ್ಡರ್") },
        { key: "0", label: L("Talk to an operator", "ऑपरेटर से बात करें", "ಆಪರೇಟರ್") },
      ];
    case "BUYER_CROP_SELECT":
      return CROPS.map((c) => ({ key: c.key, label: c.name }));
    case "LIST_CROP":
      return CROPS.map((c) => ({ key: c.key, label: c.name }));
    case "LIST_QUALITY":
      return [
        { key: "1", label: "Grade A", description: L("Premium", "प्रीमियम", "ಪ್ರೀಮಿಯಂ") },
        { key: "2", label: "Grade B", description: L("Standard", "मानक", "ಪ್ರಮಾಣಿತ") },
        { key: "3", label: "Grade C", description: L("Economy", "किफायती", "ಆರ್ಥಿಕ") },
      ];
    case "LIST_CONFIRM":
    case "BUYER_OFFER_CONFIRM":
      return [
        { key: "1", label: L("Confirm", "पुष्टि करें", "ಖಚಿತಪಡಿಸಿ") },
        { key: "2", label: L("Cancel", "रद्द करें", "ರದ್ದುಮಾಡಿ") },
      ];
    case "FPO_CONTRIB_CONFIRM":
      return [
        { key: "1", label: L("Confirm pool", "पूल की पुष्टि", "ಪೂಲ್ ಖಚಿತಪಡಿಸಿ") },
        { key: "2", label: L("Cancel", "रद्द करें", "ರದ್ದುಮಾಡಿ") },
      ];
    default:
      return undefined;
  }
}

/* ====================================================================== */
/*  Advance                                                               */
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
        return { session, prompt: PROMPTS[lang].idInput };
      }
      if (input === "2") {
        session.role = "buyer";
        session.step = "ID_INPUT";
        return { session, prompt: PROMPTS[lang].idInput };
      }
      if (input === "3") {
        session.role = "fpo";
        session.step = "ID_INPUT";
        return { session, prompt: PROMPTS[lang].idInput };
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
        if (session.role === "fpo") {
          session.step = "MAIN_MENU_FPO";
          return {
            session,
            prompt: PROMPTS[lang].mainMenuFPO,
            options: optionsForStep("MAIN_MENU_FPO", lang),
          };
        }
        if (session.role === "buyer") {
          session.step = "MAIN_MENU_BUYER";
          return {
            session,
            prompt: PROMPTS[lang].mainMenuBuyer,
            options: optionsForStep("MAIN_MENU_BUYER", lang),
          };
        }
        session.step = "MAIN_MENU";
        return {
          session,
          prompt: PROMPTS[lang].mainMenuFarmer,
          options: optionsForStep("MAIN_MENU", lang),
        };
      }
      session.otpAttempts += 1;
      if (session.otpAttempts >= 3) {
        session.step = "END";
        return { session, prompt: PROMPTS[lang].otpTooMany, terminal: true };
      }
      return { session, prompt: PROMPTS[lang].otpWrong };
    }

    /* ---------------- FARMER MAIN MENU ---------------- */
    case "MAIN_MENU": {
      if (input === "1") {
        session.step = "LIST_CROP";
        return {
          session,
          prompt: PROMPTS[lang].listCrop ?? "Which crop?",
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
        return { session, prompt: "Connecting to an operator." };
      }
      return {
        session,
        prompt: PROMPTS[lang].unknown,
        options: optionsForStep("MAIN_MENU", lang),
      };
    }

    /* ---------------- FPO MAIN MENU ---------------- */
    case "MAIN_MENU_FPO": {
      if (input === "1") {
        session.step = "LIST_CROP";
        return {
          session,
          prompt: PROMPTS[lang].listCrop ?? "Which crop?",
          options: optionsForStep("LIST_CROP", lang),
        };
      }
      if (input === "2") {
        session.step = "OFFERS_LIST";
        return { session, prompt: "Loading group offers…" };
      }
      if (input === "3") {
        session.step = "PRICES_MENU";
        return { session, prompt: "Loading mandi prices…" };
      }
      if (input === "0") {
        return { session, prompt: "Connecting to an operator." };
      }
      return {
        session,
        prompt: PROMPTS[lang].unknown,
        options: optionsForStep("MAIN_MENU_FPO", lang),
      };
    }

    /* ---------------- BUYER MAIN MENU ---------------- */
    case "MAIN_MENU_BUYER": {
      if (input === "1") {
        session.step = "BUYER_CROP_SELECT";
        return {
          session,
          prompt: PROMPTS[lang].buyerCropSelect,
          options: optionsForStep("BUYER_CROP_SELECT", lang),
        };
      }
      if (input === "2") {
        session.step = "BUYER_BIDS_VIEW";
        return { session, prompt: "Loading your bids…" };
      }
      if (input === "3") {
        session.step = "BUYER_ORDERS_VIEW";
        return { session, prompt: "Loading your orders…" };
      }
      if (input === "0") {
        return { session, prompt: "Connecting to an operator." };
      }
      return {
        session,
        prompt: PROMPTS[lang].unknown,
        options: optionsForStep("MAIN_MENU_BUYER", lang),
      };
    }

    /* ---------------- BUYER CROP SELECT ---------------- */
    case "BUYER_CROP_SELECT": {
      const crop = CROPS.find((c) => c.key === input);
      if (!crop) {
        return {
          session,
          prompt: PROMPTS[lang].buyerCropSelect,
          options: optionsForStep("BUYER_CROP_SELECT", lang),
        };
      }
      session.draft.crop = crop.name;
      session.step = "BUYER_LISTING_LIST";
      return { session, prompt: "Loading listings…" };
    }

    /* ---------------- BUYER LISTING LIST ---------------- */
    case "BUYER_LISTING_LIST": {
      // The client handles listing navigation; this is fallback
      return { session, prompt: "Loading listings…" };
    }

    /* ---------------- BUYER OFFER QTY ---------------- */
    case "BUYER_OFFER_QTY": {
      const clean = input.replace(/[#*]/g, "");
      const qty = Number(clean);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { session, prompt: PROMPTS[lang].buyerOfferQtyAsk };
      }
      session.draft.buyerOfferQty = qty;
      session.step = "BUYER_OFFER_PRICE";
      return { session, prompt: PROMPTS[lang].buyerOfferPriceAsk };
    }

    /* ---------------- BUYER OFFER PRICE ---------------- */
    case "BUYER_OFFER_PRICE": {
      const clean = input.replace(/[#*]/g, "");
      const price = Number(clean);
      if (!Number.isFinite(price) || price <= 0) {
        return { session, prompt: PROMPTS[lang].buyerOfferPriceAsk };
      }
      session.draft.buyerOfferPrice = price;
      session.step = "BUYER_OFFER_CONFIRM";
      const total = (session.draft.buyerOfferQty ?? 0) * price;
      return {
        session,
        prompt: t("buyerOfferConfirm", lang, {
          crop: session.draft.buyerListingCrop ?? "",
          qty: session.draft.buyerOfferQty ?? 0,
          price,
          total: total.toLocaleString("en-IN"),
        }),
        options: optionsForStep("BUYER_OFFER_CONFIRM", lang),
      };
    }

    /* ---------------- BUYER OFFER CONFIRM ---------------- */
    case "BUYER_OFFER_CONFIRM": {
      if (input === "1") {
        return { session, prompt: "Placing your offer…" };
      }
      if (input === "2") {
        session.draft.buyerListingId = undefined;
        session.draft.buyerListingCrop = undefined;
        session.draft.buyerListingPrice = undefined;
        session.draft.buyerOfferQty = undefined;
        session.draft.buyerOfferPrice = undefined;
        session.step = "MAIN_MENU_BUYER";
        return {
          session,
          prompt: PROMPTS[lang].mainMenuBuyer,
          options: optionsForStep("MAIN_MENU_BUYER", lang),
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    /* ---------------- LIST (farmer + FPO shared) ---------------- */
    case "LIST_CROP": {
      const crop = CROPS.find((c) => c.key === input);
      if (!crop) {
        return {
          session,
          prompt: "Which crop?",
          options: optionsForStep("LIST_CROP", lang),
        };
      }
      session.draft.crop = crop.name;
      session.step = "LIST_QUANTITY";
      return { session, prompt: "How many kilograms?" };
    }

    case "LIST_QUANTITY": {
      const clean = input.replace(/[#*]/g, "");
      const qty = Number(clean);
      if (!Number.isFinite(qty) || qty <= 0) {
        return { session, prompt: "How many kilograms?" };
      }
      session.draft.quantityKg = qty;
      session.step = "LIST_QUALITY";
      return {
        session,
        prompt: "What is the quality grade?",
        options: optionsForStep("LIST_QUALITY", lang),
      };
    }

    case "LIST_QUALITY": {
      const map: Record<string, "A" | "B" | "C"> = { "1": "A", "2": "B", "3": "C" };
      const grade = map[input];
      if (!grade) {
        return {
          session,
          prompt: "What is the quality grade?",
          options: optionsForStep("LIST_QUALITY", lang),
        };
      }
      session.draft.grade = grade;
      session.step = "LIST_PRICE";
      return { session, prompt: "What is your expected price per kg?" };
    }

    case "LIST_PRICE": {
      const clean = input.replace(/[#*]/g, "");
      const price = Number(clean);
      if (!Number.isFinite(price) || price <= 0) {
        return { session, prompt: "Enter price per kg." };
      }
      session.draft.pricePerKg = price;
      session.step = "LIST_CONFIRM";
      return {
        session,
        prompt: `Confirm: ${session.draft.crop}, ${session.draft.quantityKg} kg, Grade ${session.draft.grade}, ₹${price}/kg. Press 1 to confirm, 2 to cancel.`,
        options: optionsForStep("LIST_CONFIRM", lang),
      };
    }

    case "LIST_CONFIRM": {
      if (input === "1") {
        return { session, prompt: "Saving…" };
      }
      if (input === "2") {
        session.draft = {};
        const nextStep: IvrStep =
          session.role === "fpo" ? "MAIN_MENU_FPO" : "MAIN_MENU";
        session.step = nextStep;
        const prompt =
          session.role === "fpo"
            ? PROMPTS[lang].mainMenuFPO
            : PROMPTS[lang].mainMenuFarmer;
        return {
          session,
          prompt,
          options: optionsForStep(nextStep, lang),
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    /* ---------------- FPO CONTRIBUTIONS ---------------- */
    case "FPO_CONTRIB_MEMBER": {
      const clean = input.replace(/[#*]/g, "");
      const qty = Number(clean);
      if (!Number.isFinite(qty) || qty < 0) {
        return { session, prompt: "Please enter a valid quantity." };
      }
      const idx = session.draft.memberIdx ?? 0;
      const currentMember = session.fpoMembers[idx];
      if (!currentMember) {
        session.step = "FPO_CONTRIB_CONFIRM";
        return { session, prompt: buildContribSummary(session, lang) };
      }
      const contribs = session.draft.contributions ?? [];
      contribs.push({
        memberId: currentMember.id,
        memberName: currentMember.name,
        quantityKg: qty,
      });
      session.draft.contributions = contribs;
      session.draft.memberIdx = idx + 1;

      const nextMember = session.fpoMembers[idx + 1];
      if (nextMember) {
        return {
          session,
          prompt: `How many kg is ${nextMember.name} contributing? Type and press #.`,
        };
      }
      return {
        session,
        prompt: "How many kg are you, the FPO head, contributing?",
      };
    }

    case "FPO_CONTRIB_CONFIRM": {
      if (input === "1") return { session, prompt: "Creating pool…" };
      if (input === "2") {
        session.draft = {};
        session.fpoMembers = [];
        session.step = "MAIN_MENU_FPO";
        return {
          session,
          prompt: PROMPTS[lang].mainMenuFPO,
          options: optionsForStep("MAIN_MENU_FPO", lang),
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    /* ---------------- SHARED ---------------- */
    case "OFFERS_LIST":
    case "PRICES_SHOW":
    case "BUYER_BIDS_VIEW":
    case "BUYER_ORDERS_VIEW": {
      if (input === "*") {
        const backStep: IvrStep =
          session.role === "fpo"
            ? "MAIN_MENU_FPO"
            : session.role === "buyer"
              ? "MAIN_MENU_BUYER"
              : "MAIN_MENU";
        session.step = backStep;
        const prompt =
          session.role === "fpo"
            ? PROMPTS[lang].mainMenuFPO
            : session.role === "buyer"
              ? PROMPTS[lang].mainMenuBuyer
              : PROMPTS[lang].mainMenuFarmer;
        return {
          session,
          prompt,
          options: optionsForStep(backStep, lang),
        };
      }
      return { session, prompt: "Processing…" };
    }

    case "PRICES_MENU": {
      if (input === "*") {
        const backStep: IvrStep =
          session.role === "fpo"
            ? "MAIN_MENU_FPO"
            : session.role === "buyer"
              ? "MAIN_MENU_BUYER"
              : "MAIN_MENU";
        session.step = backStep;
        const prompt =
          session.role === "fpo"
            ? PROMPTS[lang].mainMenuFPO
            : session.role === "buyer"
              ? PROMPTS[lang].mainMenuBuyer
              : PROMPTS[lang].mainMenuFarmer;
        return {
          session,
          prompt,
          options: optionsForStep(backStep, lang),
        };
      }
      return { session, prompt: PROMPTS[lang].unknown };
    }

    default:
      return { session, prompt: PROMPTS[lang].unknown, terminal: true };
  }
}

export function buildContribSummary(
  session: IvrSession,
  lang: "en" | "hi" | "kn"
): string {
  const total = session.draft.quantityKg ?? 0;
  const contribs = session.draft.contributions ?? [];
  const sum = contribs.reduce((s, c) => s + c.quantityKg, 0);
  const lines = contribs
    .map((c) => `• ${c.memberName}: ${c.quantityKg} kg`)
    .join("\n");
  return `${lines}\n\nContributions: ${sum} of ${total} kg. Press 1 to confirm, 2 to cancel.`;
}