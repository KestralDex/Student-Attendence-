# Student Attendance - Status & TODO

## ✅ Completed
- QR scanner with html5-qrcode
- Supabase auth (login/signup)
- Attendance recording via Supabase
- n8n webhook proxy (CORS fix via /dashboard/scan/export route)
- Fixed Next.js version (was 16.2.0 → now 15.3.1)
- Proxy auto-uses test URL locally, production URL on Vercel

## ⚙️ Vercel Setup Required
Add these environment variables in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📋 n8n Webhook URLs
- Test (local dev): https://shete1319.app.n8n.cloud/webhook-test/76664403-3b71-4a00-91d9-ae89debfaee3
- Production (Vercel): https://shete1319.app.n8n.cloud/webhook/76664403-3b71-4a00-91d9-ae89debfaee3
  → Make sure to ACTIVATE the n8n workflow before deploying!

## 🔲 Remaining
- [ ] Add Supabase env vars to Vercel
- [ ] Activate n8n workflow (not just test mode)
- [ ] Verify attendance data flows end-to-end in production
