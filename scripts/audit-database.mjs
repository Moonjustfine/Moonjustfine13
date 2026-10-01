import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const files = [];
for (const dir of ['supabase/migration', 'supabase/migrations']) {
  if (!fs.existsSync(path.join(root, dir))) continue;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.sql')) files.push(path.join(dir, entry.name));
  }
}

for (const rel of files) {
  if (read(rel).trim().length === 0) failures.push(`Empty SQL migration: ${rel}`);
}

const allSql = files.map(read).join('\n');
const knownMissingPrivateHelpers = [
  'private.is_hris_admin()',
  'private.hris_ess_employee_id()',
];
for (const helper of knownMissingPrivateHelpers) {
  if (allSql.includes(helper) && !new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+${helper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(allSql)) {
    failures.push(`Unsupported private helper reference remains: ${helper}`);
  }
}

for (const rel of [
  'supabase/BOOTSTRAP_FRESH_DATABASE.sql',
  'supabase/V47_COMPLETE_SUPABASE.sql',
  'supabase/PROJECT_TIRTA_COMPLETE_SCHEMA.sql',
]) {
  const sql = read(rel);
  if (!/add column if not exists alasan_keluar_kode text/i.test(sql)) failures.push(`Missing deactivation reason column in schema snapshot: ${rel}`);
}

if (/\.getPublicUrl\(/.test(read('src/components/admin/dashboard/DashboardAdmin.tsx'))) {
  failures.push('Private employee photo is still loaded with getPublicUrl().');
}

if (!/createSignedUrl\(path, 900\)/.test(read('src/components/admin/dashboard/DashboardAdmin.tsx'))) {
  failures.push('Dashboard employee photo viewer is missing signed URL loading.');
}

if (!/deactivation_reason_code/.test(read('src/pages/VerifyIdCard/VerifyIdCard.tsx'))) {
  failures.push('Public ID card verification UI is missing deactivation reason support.');
}
if (!/'deactivation_reason'\s*,/.test(read('supabase/migrations/20261001070000_release_security_and_employee_lifecycle_hardening.sql')) || !/deactivation_reason\?: string \| null/.test(read('src/pages/VerifyIdCard/VerifyIdCard.tsx'))) {
  failures.push('Public ID card verification is missing the recorded exit-reason field.');
}
if (!/data\?\.deactivation_reason\?\.trim\(\)/.test(read('src/pages/VerifyIdCard/VerifyIdCard.tsx'))) {
  failures.push('Public ID card verification UI is not rendering the recorded exit reason.');
}

if (!/public\.hris_has_permission\('people\.read'\)/.test(read('supabase/migrations/20261001070000_release_security_and_employee_lifecycle_hardening.sql'))) {
  failures.push('Release hardening migration is missing permission-based QR/storage authorization.');
}

if (failures.length) {
  console.error('Database audit FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Database audit passed: ${files.length} SQL migrations checked + employee lifecycle/QR/storage/ESS hardening checks.`);
