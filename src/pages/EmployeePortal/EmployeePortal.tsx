import { Capacitor } from '@capacitor/core';
import PortalKaryawan from '../../components/karyawan/dashboard/PortalKaryawan';
import PortalKaryawanCosmicAndroid from '../../components/karyawan/dashboard/PortalKaryawanCosmicAndroid';

export default function EmployeePortal() {
  const isAndroid = Capacitor.getPlatform() === 'android';

  return isAndroid ? <PortalKaryawanCosmicAndroid /> : <PortalKaryawan />;
}
