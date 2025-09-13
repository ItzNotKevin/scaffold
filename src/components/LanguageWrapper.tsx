import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageWrapperProps {
  children: React.ReactNode;
}

const LanguageWrapper: React.FC<LanguageWrapperProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [key, setKey] = useState(0);

  useEffect(() => {
    const handleLanguageChange = () => {
      setKey(prev => prev + 1);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  return <div key={key}>{children}</div>;
};

export default LanguageWrapper;
