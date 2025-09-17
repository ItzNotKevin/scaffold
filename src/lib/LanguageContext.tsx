import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  forceUpdate: () => void;
  languageKey: number;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
      setUpdateKey(prev => prev + 1);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const forceUpdate = () => {
    setUpdateKey(prev => prev + 1);
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, forceUpdate, languageKey: updateKey }}>
      {children}
    </LanguageContext.Provider>
  );
};
