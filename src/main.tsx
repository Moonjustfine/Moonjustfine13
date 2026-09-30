import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './locales/LanguageContext';
import { registerPwa } from './pwa';
import { initializeCosmicTheme } from './theme/professionalTheme';
import { installLoadingStyles } from './loading-real-final-v57.15';
import { installCosmicSurfaceFinal } from './theme/cosmicSurfaceFinal';
import { installDesktopCosmicBackgroundFinal } from './theme/desktopCosmicBackgroundFinal';
import { Capacitor } from '@capacitor/core';
import { installDesktopCardFix } from './theme/desktopCardFix';
import { installDesktopSidebarFix } from './theme/desktopSidebarFix';
import { installDesktopCosmicCardsFinal } from './theme/desktopCosmicCardsFinal';
import { installDesktopSharpBackground } from './theme/desktopSharpBackground';
import { installDesktopCosmicPolish } from './theme/desktopCosmicPolish';
import { installDesktopNoWhiteSurface } from './theme/desktopNoWhiteSurface';

registerPwa();
initializeCosmicTheme();
installLoadingStyles();
installCosmicSurfaceFinal();
installDesktopCosmicBackgroundFinal();

if (Capacitor.getPlatform() !== 'android') {
  installDesktopCardFix();
  installDesktopSidebarFix();
  installDesktopCosmicCardsFinal();
  installDesktopSharpBackground();
  installDesktopCosmicPolish();
  installDesktopNoWhiteSurface();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);
