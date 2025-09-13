import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../locales/en.json';
import esTranslations from '../locales/es.json';
import frTranslations from '../locales/fr.json';
import zhTranslations from '../locales/zh.json';

const resources = {
  en: {
    translation: enTranslations
  },
  es: {
    translation: esTranslations
  },
  fr: {
    translation: frTranslations
  },
  zh: {
    translation: zhTranslations
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    }
  });

// Initialize with saved language or default
const savedLanguage = localStorage.getItem('i18nextLng') || 'en';
i18n.changeLanguage(savedLanguage);

// Function to change language and save to localStorage
export const changeLanguage = async (lng: string) => {
  await i18n.changeLanguage(lng);
  localStorage.setItem('i18nextLng', lng);
  await i18n.reloadResources(lng);
};

// Function to get current language
export const getCurrentLanguage = () => {
  return i18n.language;
};

export default i18n;
