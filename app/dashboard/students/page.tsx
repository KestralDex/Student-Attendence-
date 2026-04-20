import { createClient } from "@/lib/supabase/server"
import { StudentsClient } from "@/components/students-client"

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get teacher's subjects to determine which years they teach
  const { data: subjects } = await supabase
    .from("subjects")
    .select("year")
    .eq("teacher_id", user?.id)

  const years = [...new Set(subjects?.map(s => s.year) || [])]

  // Get students for the years the teacher teaches
  const { data: students } = await supabase
    .from("students")
    .select("*")
    .in("year", years.length > 0 ? years : ["NONE"])
    .order("roll_no")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">
          Manage students in your classes
        </p>
      </div>

      <StudentsClient initialStudents={students || []} years={years} />
    </div>
  )
}
