import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ta from "./ta.json";
import { cache } from "../services/cache";

const savedLang = cache.getPrefs().language || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
