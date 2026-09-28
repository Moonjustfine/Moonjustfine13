import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './locales/LanguageContext';
import { registerPwa } from './pwa';
import { initializeCosmicTheme } from './theme/professionalTheme';
import { installLoadingStyles } from './loading-real-final-v57.15';

registerPwa();
if (Capacitor.getPlatform() === 'android') initializeCosmicTheme();
installLoadingStyles();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);
