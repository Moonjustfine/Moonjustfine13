import fs from 'node:fs';

const themeFile = fs.readFileSync('src/theme/professionalTheme.ts', 'utf8');
const appFile = fs.readFileSync('src/App.tsx', 'utf8');
const dashboardFile = fs.readFileSync('src/components/admin/dashboard/DashboardAdmin.tsx', 'utf8');
const errors = [];

if (!/COSMIC_THEMES/.test(themeFile)) errors.push('Cosmic theme registry missing.');
if (!/ADMIN_THEMES/.test(themeFile)) errors.push('Admin-only theme registry missing.');
for (const id of ['sun','moon','galaxy','blackhole','nebula','aurora']) {
  if (!new RegExp(`"${id}"\\s*:`).test(themeFile)) errors.push(`Cosmic theme missing: ${id}`);
}
if (!/id:'custom'/.test(fs.readFileSync('src/components/admin/dashboard/DashboardAdmin.tsx','utf8'))) errors.push('Custom theme flow missing.');
if (!/localStorage\.setItem\(THEME_STORAGE_KEY/.test(themeFile)) errors.push('Cosmic theme persistence missing.');
if (!/prefers-reduced-motion/.test(themeFile)) errors.push('Reduced-motion support missing.');
if (!/@keyframes pt-(sun-breathe|moon-drift|galaxy-rotate|blackhole-orbit|nebula-flow)/.test(themeFile)) errors.push('Animated cosmic theme keyframes missing.');
if (!/pt-aurora-ambient/.test(themeFile)) errors.push('Aurora ambient layer missing.');
const auroraRules = [...themeFile.matchAll(/html\[data-cosmic-theme=\"aurora\"\][^{]*\{([^}]*)\}/g)].map(m => m[1]).join('\n');
if (/\b(display|position|width|height|min-width|min-height|padding|margin|grid|flex|left|right|top|bottom|inset|gap|transform-origin)\s*:/.test(auroraRules)) errors.push('Aurora theme contains layout/geometry overrides; keep it visual-only.');
if (!/applyCosmicTheme\(/.test(dashboardFile)) errors.push('Theme switcher action missing.');
if (!/COSMIC_THEMES\[id\]\.name/.test(dashboardFile)) errors.push('Theme switcher labels missing.');
for (const id of ['professional']) {
  if (!new RegExp(`key:\s*'${id}'`).test(dashboardFile) && !new RegExp(`\{id:'${id}'`).test(dashboardFile)) errors.push(`Admin theme missing from dashboard: ${id}`);
}
if (!/loadAdminThemePreference/.test(dashboardFile) || !/saveAdminThemePreference/.test(dashboardFile)) errors.push('Admin theme persistence flow missing.');
if (!/setEmployeePortalTheme\(cosmic/.test(dashboardFile)) errors.push('Employee portal theme isolation check missing.');
if (/id:'aurora'[^\n]*adminOnly:true/.test(dashboardFile)) errors.push('Aurora must remain a global theme, not admin-only.');
if (!/professional:/.test(themeFile) || !/value === 'professional'/.test(themeFile)) errors.push('Professional HRIS admin-only registry missing or broadened.');

const cssFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','.git','dist'].includes(e.name)) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p); else if (/\.(css|scss|sass)$/.test(e.name)) cssFiles.push(p);
  }
}
walk('src');
if (cssFiles.length) errors.push(`Standalone stylesheet files remain: ${cssFiles.join(', ')}`);

if (errors.length) {
  console.error('Theme audit FAILED');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log('Theme audit passed: 6 animated cosmic themes + 1 admin-only theme + Aurora visual-only scope guard + custom theme + persistence + reduced-motion + CSS-free source tree.');
