/**
 * /dashboard/scan/export  — POST
 *
 * Proxy route: receives attendance payload from the frontend,
 * fetches a Google OAuth token server-side, and forwards everything
 * to the Base44 syncAttendanceToSheets function.
 *
 * Replaces the old n8n webhook proxy.
 */

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// ── Base44 config ───────────────────────────────────────────────────
const BASE44_FUNCTION_URL =
  "https://69ebd5ce42f9355648bf96b0.base44.app/functions/syncAttendanceToSheets"

// Service token for Base44 backend function auth (add to Vercel env vars)
// Get this from: https://app.base44.com → your app → Settings → API Keys
const BASE44_SERVICE_TOKEN = process.env.BASE44_SERVICE_TOKEN ?? ""

// Google OAuth token — server-side only (add to Vercel env vars)
// This is a long-lived refresh token or a service-account token with Sheets access.
// Simplest approach: use a Google service account JSON key and generate a token,
// OR paste your OAuth access token here temporarily for testing.
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_SHEETS_ACCESS_TOKEN ?? ""

export async function POST(request: NextRequest) {
  try {
    // Verify Supabase auth
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!GOOGLE_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "GOOGLE_SHEETS_ACCESS_TOKEN env var is not set on the server." },
        { status: 500 }
      )
    }

    const body = await request.json()

    // Forward to Base44 with the Google token injected server-side
    const base44Response = await fetch(BASE44_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Base44 service auth — allows calling the function without a browser session
        ...(BASE44_SERVICE_TOKEN ? { Authorization: `Bearer ${BASE44_SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        ...body,
        googleToken: GOOGLE_ACCESS_TOKEN,
        // map subject_year from export-client payload
        subject_year: body.subject_year ?? body.records?.[0]?.year,
      }),
    })

    const responseText = await base44Response.text()
    let result: Record<string, unknown> = {}
    if (responseText) {
      try { result = JSON.parse(responseText) } catch { result = { message: responseText } }
    }

    if (!base44Response.ok) {
      console.error("Base44 sync error:", base44Response.status, result)
      return NextResponse.json(
        { error: "Failed to sync to Google Sheets", details: result },
        { status: base44Response.status }
      )
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Export proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}
