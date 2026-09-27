import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../locales/LanguageContext';
import type { Karyawan } from './types';
import { supabase } from '../../../lib/supabase/client';
import { code128SvgMarkup } from '../../../lib/code128';
import { qrMatrixToSvg } from '../../../lib/qr';

type Employee = Karyawan & {
  foto_url?: string | null;
  foto?: string | null;
  photo_url?: string | null;
};

type Props = {
  employees: Employee[];
  companyName: string;
  logoUrl: string;
};

type IDCardDesignTheme = keyof typeof ID_CARD_DESIGN_THEMES;

type IDCardDesign = {
  theme: IDCardDesignTheme;
  companyName: string;
  logoDataUrl: string;
  showQr: boolean;
  showBarcode: boolean;
};

type Palette = {
  top: string;
  top2: string;
  body: string;
  body2: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  line: string;
};

const ID_CARD_STORAGE_KEY = 'project-tirta-id-card-design-v2';

const ID_CARD_DESIGN_THEMES: Record<
  string,
  { label: string; palette: Palette }
> = {
  moon: {
    label: 'Bulan',
    palette: {
      top: '#071a3d', top2: '#16335e', body: '#0a1222', body2: '#111c30',
      accent: '#d6ae58', accentSoft: '#f0d68c', text: '#f7f9fc', muted: '#aeb8c9', line: '#2e3f5f',
    },
  },
  sun: {
    label: 'Matahari',
    palette: {
      top: '#321507', top2: '#87440f', body: '#1b0b05', body2: '#2b1208',
      accent: '#f6c767', accentSoft: '#ffe4a5', text: '#fffaf0', muted: '#e6c99d', line: '#654126',
    },
  },
  galaxy: {
    label: 'Galaksi',
    palette: {
      top: '#1b103d', top2: '#47308a', body: '#0d0820', body2: '#1a1230',
      accent: '#d7adff', accentSoft: '#efdfff', text: '#fbf8ff', muted: '#c6bdd9', line: '#4c3b72',
    },
  },
  blackhole: {
    label: 'Blackhole',
    palette: {
      top: '#050609', top2: '#18202a', body: '#020307', body2: '#091018',
      accent: '#e8c36f', accentSoft: '#ffe7a4', text: '#f6fbff', muted: '#a7b4c0', line: '#31404d',
    },
  },
  nebula: {
    label: 'Nebula',
    palette: {
      top: '#32102f', top2: '#5e2e76', body: '#130712', body2: '#211028',
      accent: '#ffbfe8', accentSoft: '#ffe0f3', text: '#fff6fd', muted: '#d6bfce', line: '#64445d',
    },
  },
};

const DEFAULT_DESIGN = (companyName: string): IDCardDesign => ({
  theme: 'moon',
  companyName,
  logoDataUrl: '',
  showQr: true,
  showBarcode: true,
});

function safeId(employee: Employee) {
  return employee.id_karyawan || employee.id || 'EMPLOYEE';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'ID';
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeImageHref(value: string) {
  const trimmed = String(value || '').trim();
  if (/^(?:https?:\/\/|\/|data:image\/)/i.test(trimmed)) return escapeXml(trimmed);
  return '';
}

function fittedFontSize(value: unknown, base: number, min: number, maxWidth = 490) {
  const text = String(value ?? '');
  if (!text) return base;
  const estimated = Math.floor(maxWidth / Math.max(text.length * 0.55, 1));
  return Math.max(min, Math.min(base, estimated));
}

function getVerifyBaseUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_VERIFY_BASE_URL || '').trim();
  if (configured) return `${configured.replace(/\/+$/, '')}/`;
  const pathname = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return `${window.location.origin}${pathname}`;
}

function buildVerifyUrl(token: string) {
  return `${getVerifyBaseUrl()}#/verify/${encodeURIComponent(token)}`;
}

function imageFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (file.size > 1024 * 1024) {
      reject(new Error('Logo maksimal 1 MB.'));
      return;
    }
    if (!/^image\/(?:png|jpeg|webp|svg\+xml)$/i.test(file.type)) {
      reject(new Error('Gunakan logo PNG, JPG, WEBP, atau SVG.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Logo gagal dibaca.'));
    reader.readAsDataURL(file);
  });
}

function CardArtwork({
  employee,
  side,
  design,
  logoUrl,
  photoOverride,
  verificationToken,
}: {
  employee: Employee;
  side: 'front' | 'back';
  design: IDCardDesign;
  logoUrl: string;
  photoOverride?: string;
  verificationToken?: string;
}) {
  const photo = photoOverride || employee.foto_url || employee.foto || employee.photo_url || '';
  const id = safeId(employee);
  const width = 856;
  const height = 540;
  const palette = ID_CARD_DESIGN_THEMES[design.theme].palette;
  const logo = design.logoDataUrl || logoUrl;
  const gradientId = `pt-card-${design.theme}-${side}`.replace(/[^a-z0-9-]/gi, '');
  const photoSvg = photo
    ? `<image href="${safeImageHref(photo)}" x="58" y="140" width="190" height="238" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="58" y="140" width="190" height="238" rx="20" fill="${palette.body2}" stroke="${palette.line}" stroke-width="2"/><text x="153" y="287" text-anchor="middle" font-size="62" font-weight="700" fill="${palette.accentSoft}">${escapeXml(initials(employee.nama))}</text>`;

  if (side === 'back') {
    const qr = design.showQr && verificationToken
      ? `<rect x="631" y="143" width="172" height="172" rx="15" fill="#ffffff" stroke="${palette.accent}" stroke-width="4"/><g transform="translate(642 154) scale(1.01)">${qrMatrixToSvg(buildVerifyUrl(verificationToken), { size: 150, margin: 4, foreground: '#000000', background: '#ffffff', ecclevel: 'M' })}</g><text x="717" y="337" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="${palette.accentSoft}">SCAN UNTUK VERIFIKASI</text>`
      : `<rect x="631" y="143" width="172" height="172" rx="15" fill="${palette.body2}" stroke="${palette.line}" stroke-width="2"/><text x="717" y="218" text-anchor="middle" font-family="Arial" font-size="14" fill="${palette.muted}">QR VERIFIKASI</text><text x="717" y="243" text-anchor="middle" font-family="Arial" font-size="12" fill="${palette.muted}">menunggu token</text>`;

    const barcode = design.showBarcode
      ? `<text x="54" y="300" font-family="Arial" font-size="13" font-weight="700" fill="${palette.accentSoft}">CODE 128</text><g transform="translate(54 312)">${code128SvgMarkup(id, 510, 64)}</g><text x="54" y="397" font-family="Arial" font-size="18" font-weight="700" fill="${palette.text}">${escapeXml(id)}</text>`
      : `<text x="54" y="318" font-family="Arial" font-size="13" fill="${palette.muted}">ID KARYAWAN</text><text x="54" y="350" font-family="Arial" font-size="24" font-weight="700" fill="${palette.text}">${escapeXml(id)}</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${palette.top}"/><stop offset="1" stop-color="${palette.top2}"/></linearGradient></defs>
      <rect width="856" height="540" rx="34" fill="${palette.body}"/>
      <rect width="856" height="104" rx="34" fill="url(#${gradientId})"/><rect y="70" width="856" height="34" fill="url(#${gradientId})"/>
      <rect x="1" y="1" width="854" height="538" rx="33" fill="none" stroke="${palette.accent}" stroke-width="2" opacity=".92"/>
      <image href="${safeImageHref(logo)}" x="48" y="24" width="58" height="58" preserveAspectRatio="xMidYMid meet"/>
      <text x="126" y="59" font-family="Arial" font-size="27" font-weight="700" fill="${palette.text}">${escapeXml(design.companyName)}</text>
      <text x="54" y="148" font-family="Arial" font-size="18" font-weight="700" fill="${palette.accentSoft}">KARTU IDENTITAS KARYAWAN</text>
      <text x="54" y="177" font-family="Arial" font-size="14" fill="${palette.muted}">Identitas resmi • Validasi melalui sistem Project by Tirta</text>
      <text x="54" y="214" font-family="Arial" font-size="13" font-weight="700" fill="${palette.accentSoft}">INFORMASI KARTU</text>
      <text x="54" y="239" font-family="Arial" font-size="14" fill="${palette.text}">Gunakan QR di sisi kanan untuk memeriksa status kartu.</text>
      <text x="54" y="266" font-family="Arial" font-size="14" fill="${palette.text}">Kartu tidak memuat data sensitif pemegangnya.</text>
      ${barcode}
      ${qr}
      <rect x="54" y="437" width="748" height="1" fill="${palette.line}"/>
      <text x="54" y="472" font-family="Arial" font-size="12" fill="${palette.muted}">Jangan dipinjamkan. Pemeriksaan keaslian dilakukan pada domain resmi perusahaan.</text>
      <text x="802" y="507" text-anchor="end" font-family="Arial" font-size="12" font-weight="700" fill="${employee.status_aktif === false ? '#ff9eae' : palette.accentSoft}">${employee.status_aktif === false ? 'NONAKTIF' : 'AKTIF'}</text>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${palette.top}"/><stop offset="1" stop-color="${palette.top2}"/></linearGradient></defs>
    <rect width="856" height="540" rx="34" fill="${palette.body}"/>
    <rect width="856" height="120" rx="34" fill="url(#${gradientId})"/><rect y="88" width="856" height="32" fill="url(#${gradientId})"/>
    <rect x="1" y="1" width="854" height="538" rx="33" fill="none" stroke="${palette.accent}" stroke-width="2" opacity=".92"/>
    <image href="${safeImageHref(logo)}" x="52" y="28" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>
    <text x="136" y="62" font-family="Arial" font-size="28" font-weight="700" fill="${palette.text}">${escapeXml(design.companyName)}</text>
    <text x="136" y="89" font-family="Arial" font-size="13" fill="${palette.accentSoft}">PROJECT BY TIRTA • KARTU IDENTITAS KARYAWAN</text>
    ${photoSvg}
    <rect x="58" y="140" width="190" height="238" rx="20" fill="none" stroke="${palette.accent}" stroke-width="2"/>
    <text x="285" y="160" font-family="Arial" font-size="14" font-weight="700" fill="${palette.accentSoft}">NAMA LENGKAP</text>
    <text x="285" y="194" font-family="Arial" font-size="${fittedFontSize(employee.nama, 28, 15, 490)}" font-weight="700" fill="${palette.text}">${escapeXml(employee.nama || '-')}</text>
    <text x="285" y="237" font-family="Arial" font-size="14" font-weight="700" fill="${palette.accentSoft}">JABATAN</text>
    <text x="285" y="269" font-family="Arial" font-size="${fittedFontSize(employee.jabatan, 20, 13, 490)}" fill="${palette.text}">${escapeXml(employee.jabatan || '-')}</text>
    <text x="285" y="312" font-family="Arial" font-size="14" font-weight="700" fill="${palette.accentSoft}">ID KARYAWAN</text>
    <text x="285" y="344" font-family="Arial" font-size="22" font-weight="700" fill="${palette.text}">${escapeXml(id)}</text>
    <text x="285" y="387" font-family="Arial" font-size="14" font-weight="700" fill="${palette.accentSoft}">DEPARTEMEN</text>
    <text x="285" y="417" font-family="Arial" font-size="${fittedFontSize(employee.departemen, 18, 13, 490)}" fill="${palette.text}">${escapeXml(employee.departemen || '-')}</text>
    <rect x="54" y="439" width="748" height="1" fill="${palette.line}"/>
    <text x="54" y="470" font-family="Arial" font-size="11" fill="${palette.muted}">Status kartu: ${employee.status_aktif === false ? 'NONAKTIF' : 'AKTIF'}</text>
    <text x="802" y="470" text-anchor="end" font-family="Arial" font-size="11" fill="${palette.muted}">Validasi: QR Code</text>
    <text x="54" y="506" font-family="Arial" font-size="12" fill="${palette.muted}">Kartu ini hanya sah selama status karyawan tercatat aktif di Project by Tirta.</text>
  </svg>`;
}

export default function IDCardModule({ employees, companyName, logoUrl }: Props) {
  const { t } = useTranslation();
  const eligibleEmployees = useMemo(() => employees.filter(e => e.status_aktif === true), [employees]);
  const [selectedId, setSelectedId] = useState(eligibleEmployees[0]?.id || '');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [query, setQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string[]>([]);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [design, setDesign] = useState<IDCardDesign>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_DESIGN(companyName);
    try {
      const saved = JSON.parse(localStorage.getItem(ID_CARD_STORAGE_KEY) || 'null') as Partial<IDCardDesign> | null;
      if (!saved) return DEFAULT_DESIGN(companyName);
      return {
        ...DEFAULT_DESIGN(companyName),
        ...saved,
        companyName: typeof saved.companyName === 'string' && saved.companyName.trim() ? saved.companyName : companyName,
        theme: saved.theme && saved.theme in ID_CARD_DESIGN_THEMES ? saved.theme : 'moon',
        logoDataUrl: typeof saved.logoDataUrl === 'string' ? saved.logoDataUrl : '',
        showQr: saved.showQr !== false,
        showBarcode: saved.showBarcode !== false,
      };
    } catch {
      return DEFAULT_DESIGN(companyName);
    }
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const tokenCache = useRef(new Map<string, string>());

  const updateDesign = (patch: Partial<IDCardDesign>) => {
    setDesign(current => ({ ...current, ...patch }));
  };

  useEffect(() => {
    try {
      localStorage.setItem(ID_CARD_STORAGE_KEY, JSON.stringify(design));
    } catch (error) {
      console.warn('Desain ID Card tidak dapat disimpan:', error);
    }
  }, [design]);

  const filtered = useMemo(
    () => eligibleEmployees.filter(e => `${e.nama} ${e.id_karyawan || ''} ${e.jabatan || ''}`.toLowerCase().includes(query.toLowerCase())),
    [eligibleEmployees, query]
  );

  const employee = eligibleEmployees.find(e => e.id === selectedId) || filtered[0] || eligibleEmployees[0];

  useEffect(() => {
    if (employee?.id && !selectedId) setSelectedId(employee.id);
  }, [employee?.id, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const loadPhoto = async () => {
      const photo = employee?.foto_url || employee?.foto || employee?.photo_url || '';
      if (!photo) {
        setPhotoDataUrl('');
        return;
      }
      const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Gagal membaca foto'));
        reader.onerror = () => reject(new Error('Gagal membaca foto'));
        reader.readAsDataURL(blob);
      });
      try {
        let source = photo;
        const isRemote = /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(photo);
        if (!isRemote) {
          const { data, error } = await supabase.storage.from('profile-photos').createSignedUrl(photo, 900);
          if (error || !data?.signedUrl) throw error || new Error('Signed URL foto gagal');
          source = data.signedUrl;
        }
        const response = await fetch(source);
        if (!response.ok) throw new Error('Fetch foto gagal');
        const dataUrl = await toDataUrl(await response.blob());
        if (!cancelled) setPhotoDataUrl(dataUrl);
      } catch (error) {
        console.error('Fetch foto ID Card gagal:', error);
        if (!cancelled) setPhotoDataUrl('');
      }
    };
    void loadPhoto();
    return () => { cancelled = true; };
  }, [employee?.id, employee?.foto_url, employee?.foto, employee?.photo_url]);

  const ensureVerificationToken = async (employeeId: string) => {
    const emp = eligibleEmployees.find(e => e.id === employeeId);
    if (!emp) throw new Error('Karyawan tidak ditemukan.');
    const id = safeId(emp);
    const cached = tokenCache.current.get(id);
    if (cached) return cached;
    const { data, error } = await supabase.rpc('ensure_id_card_verification_token', { p_id_karyawan: id });
    if (error) throw error;
    const next = String(data || '').trim();
    if (!next) throw new Error('Token verifikasi tidak berhasil dibuat.');
    tokenCache.current.set(id, next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    const loadToken = async () => {
      if (!employee) return;
      setTokenLoading(true);
      setActionError('');
      try {
        const next = await ensureVerificationToken(employee.id);
        if (!cancelled) setToken(next);
      } catch (error) {
        console.error('Token QR ID Card gagal:', error);
        if (!cancelled) {
          setToken('');
          setActionError(error instanceof Error ? error.message : 'Token verifikasi gagal dibuat.');
        }
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    };
    void loadToken();
    return () => { cancelled = true; };
  }, [employee?.id, employee?.id_karyawan]);

  const resetDesign = () => {
    const next = DEFAULT_DESIGN(companyName);
    setDesign(next);
    setActionError('');
  };

  const unduhSvg = () => {
    if (!employee) return;
    if (!token && design.showQr) {
      setActionError('Tunggu sampai QR verifikasi selesai dibuat.');
      return;
    }
    const svg = CardArtwork({ employee, side, design, logoUrl, photoOverride: photoDataUrl, verificationToken: token });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ID-CARD-${safeId(employee)}-${side}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unduhPng = async () => {
    if (!employee) return;
    if (!token && design.showQr) {
      setActionError('Tunggu sampai QR verifikasi selesai dibuat.');
      return;
    }
    const exportSvg = CardArtwork({ employee, side, design, logoUrl, photoOverride: photoDataUrl, verificationToken: token });
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1712;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return;
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = `ID-CARD-${safeId(employee)}-${side}.png`;
        a.click();
        URL.revokeObjectURL(u);
      }, 'image/png');
    };
    img.onerror = () => setActionError('Gagal merender ID Card menjadi PNG.');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportSvg)}`;
  };

  const getPhotoDataUrl = async (photoUrl: string): Promise<string> => {
    if (!photoUrl) return '';
    try {
      const response = await fetch(photoUrl);
      if (!response.ok) throw new Error('Foto tidak dapat diambil');
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Gagal mengubah foto'));
        reader.onerror = () => reject(new Error('Gagal membaca foto'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Gagal memuat foto untuk cetak:', error);
      return '';
    }
  };

  const cetakCards = async (ids: string[]) => {
    const list = eligibleEmployees.filter(e => ids.includes(e.id));
    if (!list.length) return;
    setActionError('');
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) {
      setActionError('Pop-up diblokir. Izinkan pop-up untuk mencetak ID Card.');
      return;
    }

    win.document.write(`<!doctype html><html><head><title>ID Card ${escapeXml(design.companyName)}</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.cetak-card{width:210mm;height:297mm;display:flex;align-items:center;justify-content:center;break-after:page;page-break-after:always;overflow:hidden}.cetak-card:last-child{break-after:auto;page-break-after:auto}.cetak-card img{display:block;width:85.6mm;height:54mm;object-fit:contain}</style></head><body>`);

    try {
      for (const item of list) {
        const itemToken = design.showQr ? await ensureVerificationToken(item.id) : '';
        const photoUrl = item.foto_url || item.foto || item.photo_url || '';
        const employeePhotoDataUrl = item.id === employee?.id && photoDataUrl ? photoDataUrl : await getPhotoDataUrl(photoUrl);
        const frontSvg = CardArtwork({ employee: item, side: 'front', design, logoUrl, photoOverride: employeePhotoDataUrl, verificationToken: itemToken });
        const backSvg = CardArtwork({ employee: item, side: 'back', design, logoUrl, photoOverride: employeePhotoDataUrl, verificationToken: itemToken });
        const frontSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frontSvg)}`;
        const backSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(backSvg)}`;
        win.document.write(`<div class="cetak-card"><img src="${frontSrc}" alt="ID Card Depan" /></div><div class="cetak-card"><img src="${backSrc}" alt="ID Card Belakang" /></div>`);
      }
      win.document.write('</body></html>');
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); }, 700);
    } catch (error) {
      win.close();
      setActionError(error instanceof Error ? error.message : 'Gagal menyiapkan cetak ID Card.');
    }
  };

  const cetakCurrent = () => { if (employee) void cetakCards([employee.id]); };
  const unduhPdf = () => { if (employee) void cetakCards([employee.id]); };
  const toggleBatch = (id: string) => setSelectedBatch(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);

  const svg = employee ? CardArtwork({ employee, side, design, logoUrl, photoOverride: photoDataUrl, verificationToken: token }) : '';
  const currentTheme = ID_CARD_DESIGN_THEMES[design.theme];

  if (!employee) return <div className="panel"><p>{t('no_employee_for_id_card')}</p></div>;

  return (
    <div className="id-card-module">
      <div className="page-heading">
        <div><h1>{t('employee_id_card')}</h1><p>{t('id_card_desc')}</p></div>
        <button className="primary" onClick={cetakCurrent}>🖨️ Cetak Kartu</button>
      </div>

      {actionError && <div className="id-card-alert" role="alert">{actionError}</div>}

      <div className="id-card-designer panel">
        <div className="id-card-designer-head">
          <div><b>Designer ID Card</b><small>Ubah logo, nama perusahaan, tema, QR verifikasi, dan barcode. Perubahan tersimpan di perangkat ini.</small></div>
          <button type="button" className="secondary" onClick={resetDesign}>Reset desain</button>
        </div>
        <div className="id-card-designer-grid">
          <label><span>Nama perusahaan</span><input value={design.companyName} onChange={e => updateDesign({ companyName: e.target.value.slice(0, 60) })} maxLength={60} /></label>
          <label><span>Logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { updateDesign({ logoDataUrl: await imageFromFile(file) }); setActionError(''); } catch (error) { setActionError(error instanceof Error ? error.message : 'Logo gagal diproses.'); } }} /></label>
          <label><span>Tema ID Card</span><select value={design.theme} onChange={e => updateDesign({ theme: e.target.value as IDCardDesignTheme })}>{Object.entries(ID_CARD_DESIGN_THEMES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
          <div className="id-card-designer-toggles">
            <label><input type="checkbox" checked={design.showQr} onChange={e => updateDesign({ showQr: e.target.checked })} /> Tampilkan QR</label>
            <label><input type="checkbox" checked={design.showBarcode} onChange={e => updateDesign({ showBarcode: e.target.checked })} /> Tampilkan Code 128</label>
          </div>
        </div>
        <div className="id-card-theme-pills">{Object.entries(ID_CARD_DESIGN_THEMES).map(([id, item]) => <button key={id} type="button" className={design.theme === id ? 'active' : ''} onClick={() => updateDesign({ theme: id as IDCardDesignTheme })}><span style={{ background: item.palette.accent }} />{item.label}</button>)}</div>
        <div className="id-card-design-meta"><span>Warna aktif: <b style={{ color: currentTheme.palette.accent }}>{currentTheme.label}</b></span><span>{tokenLoading ? 'QR: menyiapkan token…' : design.showQr ? 'QR: siap diverifikasi' : 'QR: nonaktif'}</span></div>
      </div>

      <div className="id-card-toolbar">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search_employee_id')} />
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{filtered.map(e => <option key={e.id} value={e.id}>{e.nama} — {safeId(e)}</option>)}</select>
        <div className="side-switch"><button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}>{t('front')}</button><button className={side === 'back' ? 'active' : ''} onClick={() => setSide('back')}>{t('back')}</button></div>
      </div>

      <div className="id-card-layout">
        <div className="id-card-pratinjau-panel panel" ref={cardRef}>
          <div className="id-card-pratinjau" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="id-card-actions"><button className="secondary" onClick={unduhPng}>⬇️ Unduh PNG</button><button className="secondary" onClick={unduhSvg}>⬇️ Unduh SVG</button><button className="primary" onClick={unduhPdf}>⬇️ Unduh PDF — Depan + Belakang</button><button className="primary" onClick={cetakCurrent}>🖨️ Cetak — Depan + Belakang</button></div>
          <small className="id-card-note">QR berisi token acak, bukan data pribadi. Token memvalidasi ke sistem Project by Tirta dan tetap menunjuk ke karyawan yang sama saat ID Karyawan berubah.</small>
        </div>
        <div className="panel id-card-list"><div className="id-list-head"><div><b>{t('select_batch_print')}</b><small>{selectedBatch.length} karyawan dipilih</small></div><button className="link-btn" onClick={() => setSelectedBatch(filtered.map(e => e.id))}>{t('select_all')}</button></div>{filtered.map(e => <label className="id-employee-row" key={e.id}><input type="checkbox" checked={selectedBatch.includes(e.id)} onChange={() => toggleBatch(e.id)} /><span className="id-avatar">{initials(e.nama)}</span><span><b>{e.nama}</b><small>{safeId(e)} · {e.jabatan || '-'}</small></span></label>)}</div>
      </div>
    </div>
  );
}
