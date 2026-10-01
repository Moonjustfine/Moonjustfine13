import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type ModuleKey = "assistant" | "analytics" | "reports" | "feedback" | "recruitment" | "attendance" | "turnover" | "payroll" | "people";
const MODULE_PERMISSION: Record<ModuleKey, string> = {
  assistant: "ai_hr_center", analytics: "ai_hr_analytics", reports: "ai_hr_reports",
  feedback: "ai_hr_feedback", recruitment: "ai_hr_recruitment", attendance: "ai_hr_analytics",
  turnover: "ai_hr_analytics", payroll: "ai_hr_payroll", people: "ai_hr_people",
};

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: corsHeaders }); }
function cleanQuestion(v: unknown) { return String(v ?? "").trim().slice(0, 4000); }
function secretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (legacy) return legacy;
  try { return String(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""); } catch { return ""; }
}
function publishableKey() {
  try { return String(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || ""); }
  catch { return Deno.env.get("SUPABASE_ANON_KEY") || ""; }
}
async function hasPermission(client: ReturnType<typeof createClient>, code: string) {
  const { data, error } = await client.rpc("hris_has_permission", { p_code: code });
  if (error) throw error;
  return Boolean(data);
}

async function buildSnapshot(admin: ReturnType<typeof createClient>, module: ModuleKey, allowed: Set<string>) {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const snapshot: Record<string, unknown> = { generated_at: new Date().toISOString(), period: "last_30_days" };
  const { count: active, error: ae } = await admin.from("karyawan").select("id", { count: "exact", head: true }).eq("status_aktif", true);
  if (ae) throw ae;
  snapshot.headcount = { active: active ?? 0 };

  if ((module === "assistant" || module === "people") && allowed.has("ai_hr_people")) {
    const { data, error } = await admin.from("karyawan").select("id_karyawan,nama,jabatan,departemen,status_aktif,tanggal_masuk,tanggal_keluar,alasan_keluar").order("nama").limit(1000);
    if (error) throw error;
    snapshot.people = (data || []).map((p) => ({ ...p, alasan_keluar: p.status_aktif === false ? p.alasan_keluar : undefined }));
  }

  if (["analytics", "attendance", "turnover", "assistant"].includes(module) && allowed.has("ai_hr_analytics")) {
    const { data, error } = await admin.from("absensi").select("id_karyawan,tanggal,status,keterlambatan_menit,lembur_menit").gte("tanggal", from).order("tanggal", { ascending: false }).limit(10000);
    if (error) throw error;
    const rows = data || [];
    const late = rows.filter(r => Number(r.keterlambatan_menit || 0) > 0).length;
    const overtime = rows.reduce((n, r) => n + Number(r.lembur_menit || 0), 0);
    snapshot.attendance = { records: rows.length, late_records: late, late_rate_percent: rows.length ? Number((late / rows.length * 100).toFixed(1)) : 0, overtime_hours: Number((overtime / 60).toFixed(1)) };
    const { count: leavers } = await admin.from("karyawan").select("id", { count: "exact", head: true }).eq("status_aktif", false).gte("tanggal_keluar", from);
    snapshot.turnover = { leavers_30d: leavers ?? 0, active_headcount: active ?? 0 };
  }

  if (["analytics", "assistant", "reports"].includes(module) && allowed.has("ai_hr_analytics")) {
    const { count } = await admin.from("hris_employee_leave_requests").select("id", { count: "exact", head: true }).eq("status", "Menunggu");
    snapshot.leave = { pending_requests: count ?? 0 };
  }

  if (module === "feedback" && allowed.has("ai_hr_feedback")) {
    const { data, error } = await admin.from("hris_employee_feedback").select("kategori,status,created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(5000);
    if (error) throw error;
    snapshot.feedback = { total_30d: (data || []).length };
  }

  if (module === "payroll" && allowed.has("ai_hr_payroll")) {
    const { data, error } = await admin.from("hris_payroll_lines").select("amount,created_at,tipe").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(20000);
    if (error) throw error;
    snapshot.payroll = { line_count_30d: (data || []).length, amount_30d: Number((data || []).reduce((n, r) => n + Number(r.amount || 0), 0).toFixed(2)) };
  }

  if (module === "recruitment" && allowed.has("ai_hr_recruitment")) {
    const { count } = await admin.from("hris_recruitment_openings_v25").select("id", { count: "exact", head: true }).eq("status", "Open");
    snapshot.recruitment = { open_positions: count ?? 0 };
  }
  return snapshot;
}

function systemPrompt() {
  return [
    "Anda adalah AI HR Center untuk Project by Tirta.",
    "Jawab dalam Bahasa Indonesia yang jelas, profesional, dan berbasis hanya pada snapshot data yang diberikan.",
    "Jangan mengarang angka, nama, alasan, kejadian, atau kebijakan.",
    "Jangan mengambil keputusan otomatis tentang PHK, gaji, promosi, hukuman, atau persetujuan. Semua keputusan HR tetap ditinjau manusia.",
    "Jangan meminta atau menampilkan NIK, rekening, bank, password, token, atau kredensial.",
    "Jika data tidak cukup, katakan bahwa data tidak tersedia.",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const pub = publishableKey();
  const secret = secretKey();
  if (!url || !pub || !secret) return json({ error: "supabase_function_not_configured" }, 500);

  const token = auth.replace(/^Bearer\s+/i, "");
  const userClient = createClient(url, pub, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(url, secret);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const module = String(body.module || "assistant") as ModuleKey;
  const question = cleanQuestion(body.question);
  if (!Object.prototype.hasOwnProperty.call(MODULE_PERMISSION, module)) return json({ error: "invalid_module" }, 400);

  try {
    if (!await hasPermission(userClient, "ai_hr_center")) return json({ error: "forbidden", required_permission: "ai_hr_center" }, 403);
    const required = MODULE_PERMISSION[module];
    if (!await hasPermission(userClient, required)) return json({ error: "forbidden", required_permission: required }, 403);

    const { data: settings } = await admin.from("hris_ai_center_settings_v1").select("enabled,provider,model,max_output_tokens,allowed_modules").eq("id", 1).maybeSingle();
    if (settings?.enabled === false) return json({ error: "ai_center_disabled" }, 403);
    const allowedModules = Array.isArray(settings?.allowed_modules) ? settings.allowed_modules.map(String) : [];
    if (allowedModules.length && !allowedModules.includes(module)) return json({ error: "module_disabled" }, 403);
    if (String(settings?.provider || "openai") !== "openai") return json({ error: "unsupported_provider" }, 501);

    const allowed = new Set<string>();
    for (const permission of ["ai_hr_analytics","ai_hr_feedback","ai_hr_payroll","ai_hr_recruitment","ai_hr_people"]) {
      if (await hasPermission(userClient, permission)) allowed.add(permission);
    }
    const snapshot = await buildSnapshot(admin, module, allowed);
    const { data: roleData } = await userClient.rpc("current_hris_role");
    const roleName = String(roleData || "");
    const model = String(Deno.env.get("AI_MODEL") || settings?.model || "gpt-5.6");
    const maxOutputTokens = Math.max(256, Math.min(16000, Number(settings?.max_output_tokens || 1800)));
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!openaiKey) return json({ error: "missing_openai_api_key" }, 503);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, max_output_tokens: maxOutputTokens, input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt() }] },
        { role: "user", content: [{ type: "input_text", text: `Peran: ${roleName}\nModul: ${module}\nPertanyaan: ${question}\nSnapshot:\n${JSON.stringify(snapshot)}` }] },
      ]}),
    });
    const payload = await response.json();
    if (!response.ok) {
      await admin.from("hris_ai_center_audit_v1").insert({ user_id: userData.user.id, role_name: roleName, action: "assistant", module, status: "error", model, question_chars: question.length, response_chars: 0, error_code: String(payload?.error?.code || response.status) });
      return json({ error: "ai_provider_error", provider_status: response.status }, 502);
    }
    const answer = String(payload?.output_text || "").trim();
    await admin.from("hris_ai_center_audit_v1").insert({ user_id: userData.user.id, role_name: roleName, action: "assistant", module, status: "success", model, question_chars: question.length, response_chars: answer.length });
    return json({ ok: true, module, model, role: roleName, answer, snapshot });
  } catch (error) {
    console.error(error);
    return json({ error: "internal_error" }, 500);
  }
});
