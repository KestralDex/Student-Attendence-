import { createClient } from "@/lib/supabase/server"
import { SubjectsClient } from "@/components/subjects-client"

export default async function SubjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("teacher_id", user?.id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
        <p className="text-muted-foreground">
          Manage the subjects you teach
        </p>
      </div>

      <SubjectsClient 
        initialSubjects={subjects || []} 
        teacherId={user?.id || ""} 
      />
    </div>
  )
}
