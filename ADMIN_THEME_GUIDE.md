# Admin-only Themes

Project by Tirta now has two additional workspace themes: **Aurora Glass** and **Professional HRIS**.

These themes are scoped to the HR/Admin workspace only. They do not update or replace the Employee Portal theme. Employee Portal continues to use the five existing cosmic themes through `hris_get_employee_portal_theme`.

Only `Professional HRIS` is stored as an admin-only preference in `public.hris_admin_theme_preferences` with per-user RLS. `Aurora Glass` is a global cosmic theme and follows the same employee portal theme synchronization as the other cosmic themes.

`Professional HRIS` is intentionally light, neutral, office-oriented, and text-first and does not affect the employee portal. `Aurora Glass` is a dark glassmorphism option with a modern aurora accent and is shared with the employee portal. Both respect `prefers-reduced-motion`.
