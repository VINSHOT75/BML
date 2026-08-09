import React, { createContext, useContext, useState, useEffect } from 'react';

// Translations for all supported languages
const translations = {
  en: {
    // Header & Navigation
    features: "Features",
    aboutUs: "About Us",
    contact: "Contact",
    getStarted: "Get Started",
    dashboard: "Dashboard",
    
    // Hero Section
    tagline: "India's #1 Load Management Platform",
    heroTitle: "Connecting Loads, Delivering Solutions",
    heroSubtitle: "BookMyLoad bridges warehouses and transporters across India. We MANAGE your transport - not just match loads. Get reliable logistics without the hassle.",
    postYourLoad: "Post Your Load",
    findLoads: "Find Loads",
    
    // Stats
    warehouses: "Warehouses",
    transporters: "Transporters",
    loadsDelivered: "Loads Delivered",
    support: "Support",
    
    // Key Message
    notMarketplace: "BookMyLoad is not a marketplace. We MANAGE your transport.",
    
    // For Warehouses
    forWarehouses: "For Warehouses",
    warehousePitch: "BookMyLoad manages your transport, so you don't manage drivers, and hassle.",
    warehouseFeature1: "No driver management headaches",
    warehouseFeature2: "Transparent pricing & billing",
    warehouseFeature3: "Real-time shipment tracking",
    warehouseFeature4: "Dedicated logistics support",
    
    // For Transporters
    forTransporters: "For Transporters",
    transporterPitch: "BookMyLoad gives you regular loads, clear rates, and faster payments - no chasing, no confusion.",
    transporterFeature1: "Consistent load availability",
    transporterFeature2: "Clear rates upfront",
    transporterFeature3: "Faster payments guaranteed",
    transporterFeature4: "No payment chasing",
    
    // How It Works
    howItWorks: "How BookMyLoad Works",
    howItWorksSubtitle: "We manage the entire process - from pickup to delivery",
    step1Title: "Post Your Requirement",
    step1Desc: "Warehouses share load details. Transporters register their fleet. We take it from there.",
    step2Title: "We Match & Manage",
    step2Desc: "Our team assigns the right transporter, handles documentation, and coordinates pickup.",
    step3Title: "Track & Deliver",
    step3Desc: "Real-time GPS tracking, proof of delivery, and complete transparency until delivery.",
    
    // Features
    featuresTitle: "Everything You Need for Seamless Logistics",
    featuresSubtitle: "Powerful features for warehouses and transporters across India",
    featureWarehouse: "Warehouse Connect",
    featureWarehouseDesc: "Connect with our managed transporter network. No marketplace chaos - just reliable service.",
    featureTransporter: "Transporter Network",
    featureTransporterDesc: "Join our verified network. Get regular loads, clear rates, and timely payments.",
    featureTracking: "Live Tracking",
    featureTrackingDesc: "Real-time GPS tracking of all shipments from pickup to delivery.",
    featurePayments: "Fast Payments",
    featurePaymentsDesc: "Transparent billing for warehouses. Quick payments for transporters.",
    featureSupport: "24/7 Support",
    featureSupportDesc: "Dedicated support team in India and Australia to help you anytime.",
    featureAnalytics: "Smart Analytics",
    featureAnalyticsDesc: "AI-powered insights for route optimization and cost efficiency.",
    
    // About Us
    aboutUsTitle: "About BookMyLoad",
    aboutUsSubtitle: "Know About Us",
    aboutUsDesc1: "BookMyLoad is a full-service logistics management company that bridges the gap between warehouses and transporters. Unlike marketplaces that just connect and leave, we MANAGE your entire transport operation.",
    aboutUsDesc2: "Founded with a mission to simplify logistics in India, we understand the pain points of both warehouses struggling with unreliable transport and transporters chasing payments and loads. We solve both.",
    aboutUsDesc3: "With operations in India and Australia, we bring global standards to local logistics. Our technology-driven approach combined with hands-on management ensures your goods reach safely and on time.",
    
    // Contact
    contactUs: "Contact Us",
    indiaOffice: "India Office",
    australiaOffice: "Australia Office",
    emailUs: "Email Us",
    address: "Address",
    
    // CTA
    ctaTitle: "Ready to Simplify Your Logistics?",
    ctaSubtitle: "Join hundreds of warehouses and transporters who trust BookMyLoad",
    ctaButton: "Get Started Free",
    noCreditCard: "No credit card required",
    freeToStart: "Free to start",
    
    // Footer
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    allRightsReserved: "All rights reserved",
    
    // Chat
    chatWithUs: "Chat with us",
    typeMessage: "Type your message...",
    send: "Send",
    chatWelcome: "Hello! How can we help you today?",
    
    // Language
    language: "Language",
    selectLanguage: "Select Language",
  },
  
  hi: {
    // Header & Navigation
    features: "विशेषताएं",
    aboutUs: "हमारे बारे में",
    contact: "संपर्क करें",
    getStarted: "शुरू करें",
    dashboard: "डैशबोर्ड",
    
    // Hero Section
    tagline: "भारत का #1 लोड मैनेजमेंट प्लेटफॉर्म",
    heroTitle: "लोड जोड़ना, समाधान देना",
    heroSubtitle: "BookMyLoad वेयरहाउस और ट्रांसपोर्टर्स को जोड़ता है। हम आपके ट्रांसपोर्ट को मैनेज करते हैं - सिर्फ लोड मैच नहीं करते।",
    postYourLoad: "अपना लोड पोस्ट करें",
    findLoads: "लोड खोजें",
    
    // Stats
    warehouses: "वेयरहाउस",
    transporters: "ट्रांसपोर्टर",
    loadsDelivered: "लोड डिलीवर किए",
    support: "सपोर्ट",
    
    // Key Message
    notMarketplace: "BookMyLoad मार्केटप्लेस नहीं है। हम आपका ट्रांसपोर्ट मैनेज करते हैं।",
    
    // For Warehouses
    forWarehouses: "वेयरहाउस के लिए",
    warehousePitch: "BookMyLoad आपका ट्रांसपोर्ट मैनेज करता है, ताकि आपको ड्राइवर और परेशानी न संभालनी पड़े।",
    warehouseFeature1: "ड्राइवर मैनेजमेंट की परेशानी नहीं",
    warehouseFeature2: "पारदर्शी मूल्य निर्धारण",
    warehouseFeature3: "रीयल-टाइम शिपमेंट ट्रैकिंग",
    warehouseFeature4: "समर्पित लॉजिस्टिक्स सपोर्ट",
    
    // For Transporters
    forTransporters: "ट्रांसपोर्टर्स के लिए",
    transporterPitch: "BookMyLoad आपको नियमित लोड, स्पष्ट रेट, और तेज़ पेमेंट देता है - कोई पीछा नहीं, कोई भ्रम नहीं।",
    transporterFeature1: "लगातार लोड उपलब्धता",
    transporterFeature2: "पहले से स्पष्ट रेट",
    transporterFeature3: "तेज़ पेमेंट गारंटी",
    transporterFeature4: "पेमेंट के लिए नहीं भागना",
    
    // How It Works
    howItWorks: "BookMyLoad कैसे काम करता है",
    howItWorksSubtitle: "हम पूरी प्रक्रिया मैनेज करते हैं - पिकअप से डिलीवरी तक",
    step1Title: "अपनी जरूरत बताएं",
    step1Desc: "वेयरहाउस लोड डिटेल्स शेयर करें। ट्रांसपोर्टर्स अपना फ्लीट रजिस्टर करें।",
    step2Title: "हम मैच और मैनेज करते हैं",
    step2Desc: "हमारी टीम सही ट्रांसपोर्टर असाइन करती है और पिकअप कोऑर्डिनेट करती है।",
    step3Title: "ट्रैक और डिलीवर",
    step3Desc: "रीयल-टाइम GPS ट्रैकिंग और डिलीवरी तक पूरी पारदर्शिता।",
    
    // Features
    featuresTitle: "सहज लॉजिस्टिक्स के लिए सब कुछ",
    featuresSubtitle: "भारत भर के वेयरहाउस और ट्रांसपोर्टर्स के लिए शक्तिशाली फीचर्स",
    
    // About Us
    aboutUsTitle: "BookMyLoad के बारे में",
    aboutUsSubtitle: "हमें जानें",
    aboutUsDesc1: "BookMyLoad एक फुल-सर्विस लॉजिस्टिक्स मैनेजमेंट कंपनी है जो वेयरहाउस और ट्रांसपोर्टर्स के बीच की खाई को पाटती है।",
    aboutUsDesc2: "भारत में लॉजिस्टिक्स को सरल बनाने के मिशन के साथ स्थापित, हम दोनों पक्षों की समस्याओं को समझते और हल करते हैं।",
    aboutUsDesc3: "भारत और ऑस्ट्रेलिया में ऑपरेशंस के साथ, हम वैश्विक मानकों को स्थानीय लॉजिस्टिक्स में लाते हैं।",
    
    // Contact
    contactUs: "संपर्क करें",
    indiaOffice: "भारत कार्यालय",
    australiaOffice: "ऑस्ट्रेलिया कार्यालय",
    emailUs: "ईमेल करें",
    address: "पता",
    
    // CTA
    ctaTitle: "अपनी लॉजिस्टिक्स को सरल बनाने के लिए तैयार?",
    ctaSubtitle: "सैकड़ों वेयरहाउस और ट्रांसपोर्टर्स से जुड़ें जो BookMyLoad पर भरोसा करते हैं",
    ctaButton: "मुफ्त शुरू करें",
    noCreditCard: "क्रेडिट कार्ड जरूरी नहीं",
    freeToStart: "शुरू करना मुफ्त",
    
    // Footer
    privacyPolicy: "गोपनीयता नीति",
    termsOfService: "सेवा की शर्तें",
    allRightsReserved: "सर्वाधिकार सुरक्षित",
    
    // Chat
    chatWithUs: "हमसे चैट करें",
    typeMessage: "अपना संदेश लिखें...",
    send: "भेजें",
    chatWelcome: "नमस्ते! हम आज आपकी कैसे मदद कर सकते हैं?",
    
    // Language
    language: "भाषा",
    selectLanguage: "भाषा चुनें",
  },
  
  pa: {
    // Punjabi translations
    features: "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ",
    aboutUs: "ਸਾਡੇ ਬਾਰੇ",
    contact: "ਸੰਪਰਕ ਕਰੋ",
    getStarted: "ਸ਼ੁਰੂ ਕਰੋ",
    dashboard: "ਡੈਸ਼ਬੋਰਡ",
    tagline: "ਭਾਰਤ ਦਾ #1 ਲੋਡ ਮੈਨੇਜਮੈਂਟ ਪਲੇਟਫਾਰਮ",
    heroTitle: "ਲੋਡ ਜੋੜਨਾ, ਹੱਲ ਦੇਣਾ",
    heroSubtitle: "BookMyLoad ਵੇਅਰਹਾਊਸ ਅਤੇ ਟਰਾਂਸਪੋਰਟਰਾਂ ਨੂੰ ਜੋੜਦਾ ਹੈ। ਅਸੀਂ ਤੁਹਾਡੇ ਟਰਾਂਸਪੋਰਟ ਨੂੰ ਮੈਨੇਜ ਕਰਦੇ ਹਾਂ।",
    postYourLoad: "ਆਪਣਾ ਲੋਡ ਪੋਸਟ ਕਰੋ",
    findLoads: "ਲੋਡ ਲੱਭੋ",
    warehouses: "ਵੇਅਰਹਾਊਸ",
    transporters: "ਟਰਾਂਸਪੋਰਟਰ",
    loadsDelivered: "ਲੋਡ ਡਿਲੀਵਰ ਕੀਤੇ",
    support: "ਸਪੋਰਟ",
    notMarketplace: "BookMyLoad ਮਾਰਕੀਟਪਲੇਸ ਨਹੀਂ ਹੈ। ਅਸੀਂ ਤੁਹਾਡਾ ਟਰਾਂਸਪੋਰਟ ਮੈਨੇਜ ਕਰਦੇ ਹਾਂ।",
    forWarehouses: "ਵੇਅਰਹਾਊਸ ਲਈ",
    warehousePitch: "BookMyLoad ਤੁਹਾਡਾ ਟਰਾਂਸਪੋਰਟ ਮੈਨੇਜ ਕਰਦਾ ਹੈ, ਤਾਂ ਜੋ ਤੁਹਾਨੂੰ ਡਰਾਈਵਰ ਅਤੇ ਪਰੇਸ਼ਾਨੀ ਨਾ ਸੰਭਾਲਣੀ ਪਵੇ।",
    forTransporters: "ਟਰਾਂਸਪੋਰਟਰਾਂ ਲਈ",
    transporterPitch: "BookMyLoad ਤੁਹਾਨੂੰ ਨਿਯਮਤ ਲੋਡ, ਸਪੱਸ਼ਟ ਰੇਟ, ਅਤੇ ਤੇਜ਼ ਭੁਗਤਾਨ ਦਿੰਦਾ ਹੈ।",
    howItWorks: "BookMyLoad ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
    aboutUsTitle: "BookMyLoad ਬਾਰੇ",
    contactUs: "ਸੰਪਰਕ ਕਰੋ",
    indiaOffice: "ਭਾਰਤ ਦਫ਼ਤਰ",
    australiaOffice: "ਆਸਟ੍ਰੇਲੀਆ ਦਫ਼ਤਰ",
    emailUs: "ਈਮੇਲ ਕਰੋ",
    address: "ਪਤਾ",
    ctaTitle: "ਆਪਣੀ ਲੌਜਿਸਟਿਕਸ ਨੂੰ ਸਰਲ ਬਣਾਉਣ ਲਈ ਤਿਆਰ?",
    chatWithUs: "ਸਾਡੇ ਨਾਲ ਚੈਟ ਕਰੋ",
    typeMessage: "ਆਪਣਾ ਸੁਨੇਹਾ ਲਿਖੋ...",
    send: "ਭੇਜੋ",
    language: "ਭਾਸ਼ਾ",
    selectLanguage: "ਭਾਸ਼ਾ ਚੁਣੋ",
  },
  
  gu: {
    // Gujarati translations
    features: "વિશેષતાઓ",
    aboutUs: "અમારા વિશે",
    contact: "સંપર્ક કરો",
    getStarted: "શરૂ કરો",
    dashboard: "ડેશબોર્ડ",
    tagline: "ભારતનું #1 લોડ મેનેજમેન્ટ પ્લેટફોર્મ",
    heroTitle: "લોડ જોડવું, સોલ્યુશન આપવું",
    heroSubtitle: "BookMyLoad વેરહાઉસ અને ટ્રાન્સપોર્ટર્સને જોડે છે। અમે તમારા ટ્રાન્સપોર્ટને મેનેજ કરીએ છીએ।",
    postYourLoad: "તમારો લોડ પોસ્ટ કરો",
    findLoads: "લોડ શોધો",
    warehouses: "વેરહાઉસ",
    transporters: "ટ્રાન્સપોર્ટર",
    loadsDelivered: "લોડ ડિલિવર કર્યા",
    support: "સપોર્ટ",
    notMarketplace: "BookMyLoad માર્કેટપ્લેસ નથી। અમે તમારું ટ્રાન્સપોર્ટ મેનેજ કરીએ છીએ।",
    forWarehouses: "વેરહાઉસ માટે",
    warehousePitch: "BookMyLoad તમારું ટ્રાન્સપોર્ટ મેનેજ કરે છે, જેથી તમારે ડ્રાઇવર અને મુશ્કેલી ન સંભાળવી પડે।",
    forTransporters: "ટ્રાન્સપોર્ટર્સ માટે",
    transporterPitch: "BookMyLoad તમને નિયમિત લોડ, સ્પષ્ટ રેટ, અને ઝડપી પેમેન્ટ આપે છે।",
    howItWorks: "BookMyLoad કેવી રીતે કામ કરે છે",
    aboutUsTitle: "BookMyLoad વિશે",
    contactUs: "સંપર્ક કરો",
    indiaOffice: "ભારત ઓફિસ",
    australiaOffice: "ઓસ્ટ્રેલિયા ઓફિસ",
    emailUs: "ઈમેલ કરો",
    address: "સરનામું",
    ctaTitle: "તમારી લોજિસ્ટિક્સ સરળ બનાવવા તૈયાર?",
    chatWithUs: "અમારી સાથે ચેટ કરો",
    typeMessage: "તમારો સંદેશ લખો...",
    send: "મોકલો",
    language: "ભાષા",
    selectLanguage: "ભાષા પસંદ કરો",
  },
  
  mr: {
    // Marathi translations
    features: "वैशिष्ट्ये",
    aboutUs: "आमच्याबद्दल",
    contact: "संपर्क साधा",
    getStarted: "सुरू करा",
    dashboard: "डॅशबोर्ड",
    tagline: "भारतातील #1 लोड मॅनेजमेंट प्लॅटफॉर्म",
    heroTitle: "लोड जोडणे, उपाय देणे",
    heroSubtitle: "BookMyLoad वेअरहाऊस आणि ट्रान्सपोर्टर्सना जोडते। आम्ही तुमचे ट्रान्सपोर्ट मॅनेज करतो।",
    postYourLoad: "तुमचा लोड पोस्ट करा",
    findLoads: "लोड शोधा",
    warehouses: "वेअरहाऊस",
    transporters: "ट्रान्सपोर्टर",
    loadsDelivered: "लोड डिलिव्हर केले",
    support: "सपोर्ट",
    notMarketplace: "BookMyLoad मार्केटप्लेस नाही। आम्ही तुमचे ट्रान्सपोर्ट मॅनेज करतो।",
    forWarehouses: "वेअरहाऊससाठी",
    warehousePitch: "BookMyLoad तुमचे ट्रान्सपोर्ट मॅनेज करते, त्यामुळे तुम्हाला ड्रायव्हर आणि त्रास सांभाळावा लागत नाही।",
    forTransporters: "ट्रान्सपोर्टर्ससाठी",
    transporterPitch: "BookMyLoad तुम्हाला नियमित लोड, स्पष्ट दर, आणि जलद पेमेंट देते।",
    howItWorks: "BookMyLoad कसे काम करते",
    aboutUsTitle: "BookMyLoad बद्दल",
    contactUs: "संपर्क साधा",
    indiaOffice: "भारत कार्यालय",
    australiaOffice: "ऑस्ट्रेलिया कार्यालय",
    emailUs: "ईमेल करा",
    address: "पत्ता",
    ctaTitle: "तुमची लॉजिस्टिक्स सोपी करायला तयार?",
    chatWithUs: "आमच्याशी चॅट करा",
    typeMessage: "तुमचा संदेश लिहा...",
    send: "पाठवा",
    language: "भाषा",
    selectLanguage: "भाषा निवडा",
  },
  
  ta: {
    // Tamil translations
    features: "அம்சங்கள்",
    aboutUs: "எங்களை பற்றி",
    contact: "தொடர்பு கொள்ளுங்கள்",
    getStarted: "தொடங்குங்கள்",
    dashboard: "டாஷ்போர்டு",
    tagline: "இந்தியாவின் #1 சரக்கு மேலாண்மை தளம்",
    heroTitle: "சரக்குகளை இணைத்தல், தீர்வுகளை வழங்குதல்",
    heroSubtitle: "BookMyLoad கிடங்குகளையும் போக்குவரத்தாளர்களையும் இணைக்கிறது। நாங்கள் உங்கள் போக்குவரத்தை நிர்வகிக்கிறோம்.",
    postYourLoad: "உங்கள் சரக்கை பதிவிடுங்கள்",
    findLoads: "சரக்குகளை கண்டறியுங்கள்",
    warehouses: "கிடங்குகள்",
    transporters: "போக்குவரத்தாளர்கள்",
    loadsDelivered: "சரக்குகள் வழங்கப்பட்டன",
    support: "ஆதரவு",
    notMarketplace: "BookMyLoad சந்தை அல்ல। நாங்கள் உங்கள் போக்குவரத்தை நிர்வகிக்கிறோம்.",
    forWarehouses: "கிடங்குகளுக்கு",
    warehousePitch: "BookMyLoad உங்கள் போக்குவரத்தை நிர்வகிக்கிறது, எனவே நீங்கள் டிரைவர்களையும் சிரமங்களையும் கையாள வேண்டியதில்லை.",
    forTransporters: "போக்குவரத்தாளர்களுக்கு",
    transporterPitch: "BookMyLoad உங்களுக்கு வழக்கமான சரக்குகள், தெளிவான கட்டணங்கள் மற்றும் விரைவான பணம் செலுத்துதல் வழங்குகிறது.",
    howItWorks: "BookMyLoad எப்படி வேலை செய்கிறது",
    aboutUsTitle: "BookMyLoad பற்றி",
    contactUs: "தொடர்பு கொள்ளுங்கள்",
    indiaOffice: "இந்தியா அலுவலகம்",
    australiaOffice: "ஆஸ்திரேலியா அலுவலகம்",
    emailUs: "மின்னஞ்சல் அனுப்புங்கள்",
    address: "முகவரி",
    ctaTitle: "உங்கள் தளவாடங்களை எளிதாக்க தயாரா?",
    chatWithUs: "எங்களுடன் அரட்டை அடியுங்கள்",
    typeMessage: "உங்கள் செய்தியை தட்டச்சு செய்யுங்கள்...",
    send: "அனுப்பு",
    language: "மொழி",
    selectLanguage: "மொழியைத் தேர்ந்தெடுக்கவும்",
  },
};

// Language names for display
export const languageNames = {
  en: 'English',
  hi: 'हिंदी',
  pa: 'ਪੰਜਾਬੀ',
  gu: 'ગુજરાતી',
  mr: 'मराठी',
  ta: 'தமிழ்',
};

const LanguageContext = createContext(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get saved language or default to English
    const saved = localStorage.getItem('bookmyload_language');
    return saved || 'en';
  });

  useEffect(() => {
    localStorage.setItem('bookmyload_language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const value = {
    language,
    setLanguage,
    t,
    translations: translations[language] || translations.en,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
