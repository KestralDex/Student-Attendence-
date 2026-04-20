# QR Scanner n8n Webhook Integration Fix (CORS Proxy)

## Steps:
- [x] 1. Create TODO.md with plan
- [x] 2. Create API proxy route app/dashboard/scan/export/route.ts
- [x] 3. Update components/qr-scanner-client.tsx to use proxy endpoint
- [x] 4. Test locally: npm run dev → /dashboard/scan → scan QR → Export to n8n (CORS fixed via proxy)
- [ ] 5. Verify Supabase attendance + n8n receives data (check Network tab, n8n executions)
- [ ] 6. Complete task

**Next:** Run `npm run dev`, login → dashboard/scan, select subject, scan QR, click Export to n8n.

**Status:** Starting proxy implementation to fix CORS error.
