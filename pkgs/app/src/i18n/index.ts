import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import ja from "./locales/ja";

// TypeScript 型拡張: t() の引数に補完・型チェックが効く
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof ja;
    };
  }
}

i18n.use(initReactI18next).init({
  lng: localStorage.getItem("lang") ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
});

export default i18n;
