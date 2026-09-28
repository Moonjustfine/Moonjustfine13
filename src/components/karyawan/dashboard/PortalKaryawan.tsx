import { Capacitor } from '@capacitor/core';
import PortalKaryawanClassic from './PortalKaryawanClassic';
import PortalKaryawanCosmicAndroid from './PortalKaryawanCosmicAndroid';

type Props = { onLogout?: () => void };

/**
 * The Cosmic V58 redesign is intentionally Android-only.
 * Web/PWA keeps the existing employee portal implementation.
 */
export default function PortalKaryawan({ onLogout }: Props) {
  const isAndroid = Capacitor.getPlatform() === 'android';
  return isAndroid
    ? <PortalKaryawanCosmicAndroid onLogout={onLogout} />
    : <PortalKaryawanClassic onLogout={onLogout} />;
}
