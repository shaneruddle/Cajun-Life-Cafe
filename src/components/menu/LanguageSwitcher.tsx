import React from 'react';

type Language = 'en' | 'zh' | 'ru' | 'th';

interface LanguageSwitcherProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = React.memo(({ language, setLanguage }) => {
  return (
    <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-full shadow-sm border border-gray-100 max-w-fit">
      {[
        { code: 'en', label: 'EN' },
        { code: 'zh', label: '中文' },
        { code: 'ru', label: 'RU' },
        { code: 'th', label: 'TH' }
      ].map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code as Language)}
          className={`px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full text-[10px] sm:text-sm font-bold transition-all ${
            language === lang.code 
            ? "bg-terracotta text-white shadow-lg scale-105" 
            : "text-gray-400 hover:text-ink"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
});

LanguageSwitcher.displayName = 'LanguageSwitcher';

export default LanguageSwitcher;
