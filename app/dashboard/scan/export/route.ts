import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const N8N_WEBHOOK_URL = "https://shete1319.app.n8n.cloud/webhook-test/76664403-3b71-4a00-91d9-ae89debfaee3"

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Forward to n8n webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("n8n webhook error:", errorText)
      return NextResponse.json(
        { error: "Failed to send to n8n", details: errorText },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, message: "Data sent to n8n" })
  } catch (error) {
    console.error("Export proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

