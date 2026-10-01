# AI HR Center

Authenticated Supabase Edge Function for the HR AI assistant.

- Requires `ai_hr_center` plus module-specific permission.
- Reads `OPENAI_API_KEY` only inside the Edge Function.
- Uses `store: false` for OpenAI Responses requests.
- Sends only a module-scoped data snapshot to the model.
- Writes non-sensitive request metadata to `hris_ai_center_audit_v1`.
