import { createClient } from "@/lib/supabase/server"
import { QRScannerClient } from "@/components/qr-scanner-client"

export default async function ScanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, year")
    .eq("teacher_id", user?.id)
    .order("name")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan QR Code</h1>
        <p className="text-muted-foreground">
          Scan student QR codes to mark attendance
        </p>
      </div>

      <QRScannerClient subjects={subjects || []} />
    </div>
  )
}
