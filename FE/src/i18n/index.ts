import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import vi from "./locales/vi";

export const LOCALE_STORAGE_KEY = "ba_docs_locale";
export const SUPPORTED_LOCALES = ["vi", "en"] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

function getInitialLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "vi" || stored === "en") return stored;
  } catch {
    // Fall back to Vietnamese when storage is unavailable.
  }
  return "vi";
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en }
    },
    lng: getInitialLocale(),
    fallbackLng: "vi",
    interpolation: {
      escapeValue: false
    }
  });

i18n.on("languageChanged", (language) => {
  if (language === "vi" || language === "en") {
    localStorage.setItem(LOCALE_STORAGE_KEY, language);
  }
});

export default i18n;
