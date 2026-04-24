import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Use test URL for local/staging testing
// Switch to production URL when activating the n8n workflow for real deployment
const N8N_WEBHOOK_URL = process.env.NODE_ENV === "production" && process.env.N8N_USE_PROD === "true"
  ? "https://shete1319.app.n8n.cloud/webhook/76664403-3b71-4a00-91d9-ae89debfaee3"
  : "https://shete1319.app.n8n.cloud/webhook-test/76664403-3b71-4a00-91d9-ae89debfaee3"

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Forward to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error("n8n webhook error:", n8nResponse.status, errorText)
      return NextResponse.json(
        {
          error: "Failed to send to n8n",
          details: errorText,
          status: n8nResponse.status,
        },
        { status: n8nResponse.status }
      )
    }

    // n8n may return empty body on success, handle gracefully
    let n8nData = {}
    const responseText = await n8nResponse.text()
    if (responseText) {
      try {
        n8nData = JSON.parse(responseText)
      } catch {
        n8nData = { message: responseText }
      }
    }

    return NextResponse.json({ success: true, message: "Data sent to n8n", n8n: n8nData })
  } catch (error) {
    console.error("Export proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}