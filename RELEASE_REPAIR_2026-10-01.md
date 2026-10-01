# Release Repair — 2026-10-01

## Fixed

- Restored `supabase/migration/051_employee_deactivation_reason.sql`; the migration is no longer empty and now adds `karyawan.alasan_keluar_kode` plus lifecycle history support.
- Added idempotent `supabase/migrations/20261001070000_release_security_and_employee_lifecycle_hardening.sql` for existing deployments.
- Removed broken `private.is_hris_admin()` and `private.hris_ess_employee_id()` references from shipped migrations.
- ID-card QR verification now returns a structured deactivation reason code and effective date only when the employee is inactive; internal HR free-text notes are never exposed.
- ID-card token and private-photo access now use the existing permission system (`people.read` / `people.write`).
- Replaced dashboard employee-photo `getPublicUrl()` usage with signed URLs.
- Tightened registration photo uploads to JPEG/PNG/WebP and opaque UUID filenames, and added registration cleanup permission.
- Added future-date validation for employee deactivation.
- Synchronized schema snapshots with `alasan_keluar_kode` and the HRD admin role helper.
- Added `npm run audit:database` to catch empty SQL migrations, broken private helper references, public photo URL regressions, and missing deactivation/QR hardening.

## Validation

Passed:

- `npm run audit`
- `npm run audit:i18n`
- `npm run audit:theme`
- `npm run audit:pwa`
- `npm run audit:professional`
- `npm run audit:presentation`
- `npm run audit:database`
- TypeScript/TSX source parse: 67 files

Not fully verified here:

- Production `npm run build` requires a clean dependency install on Node 24.x. The inspection environment has no local `node_modules` and provides Node 22.x, so a full production build is intentionally not claimed as verified.
