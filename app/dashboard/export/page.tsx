import { createClient } from "@/lib/supabase/server"
import { ExportClient } from "@/components/export-client"

export default async function ExportPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Export Attendance</h1>
        <p className="text-muted-foreground">
          Download attendance records as CSV files
        </p>
      </div>

      <ExportClient subjects={subjects || []} />
    </div>
  )
}
