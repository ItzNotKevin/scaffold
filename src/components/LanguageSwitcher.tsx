import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { changeLanguage } from '../lib/i18n';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t, ready } = useTranslation();
  const { userProfile, updateUserProfile } = useAuth();
  const { currentLanguage, forceUpdate } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ];

  const currentLanguageObj = languages.find(lang => lang.code === currentLanguage) || languages[0];

  const handleLanguageChange = async (languageCode: string) => {
    try {
      // Only change if it's different
      if (i18n.language !== languageCode) {
        // Change language in i18next and save to localStorage
        await changeLanguage(languageCode);
        forceUpdate(); // Force re-render through context
        
        // Update user preferences if user is logged in
        if (userProfile && updateUserProfile) {
          await updateUserProfile({
            ...userProfile,
            preferences: {
              ...userProfile.preferences,
              language: languageCode
            }
          });
        }
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 sm:px-3 py-2 text-sm text-gray-700 hover:text-gray-900 active:text-gray-900 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-h-[36px]"
      >
        <span className="text-lg">{currentLanguageObj.flag}</span>
        <span className="hidden sm:inline">{currentLanguageObj.name}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[44px] ${
                i18n.language === language.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">{language.flag}</span>
              <span>{language.name}</span>
              {i18n.language === language.code && (
                <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
