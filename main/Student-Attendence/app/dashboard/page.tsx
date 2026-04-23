import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, CheckCircle, Clock } from "lucide-react"
import { RecentAttendanceTable } from "@/components/recent-attendance-table"

interface AttendanceRecord {
  id: string
  status: string
  session_date: string
  scanned_at: string | null
  students: { name: string; roll_no: string } | null
  subjects: { name: string } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats
  const { count: subjectCount } = await supabase
    .from("subjects")
    .select("*", { count: "exact", head: true })
    .eq("teacher_id", user?.id)

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, year")
    .eq("teacher_id", user?.id)

  const subjectIds = subjects?.map(s => s.id) || []
  const years = [...new Set(subjects?.map(s => s.year) || [])]

  // Get student count for the years the teacher teaches
  const { count: studentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .in("year", years.length > 0 ? years : ["NONE"])

  // Get today's attendance stats
  const today = new Date().toISOString().split("T")[0]

  const { count: presentToday } = await supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true })
    .in("subject_id", subjectIds.length > 0 ? subjectIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("session_date", today)
    .eq("status", "present")

  const { count: totalToday } = await supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true })
    .in("subject_id", subjectIds.length > 0 ? subjectIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("session_date", today)

  // Get recent attendance records
  const { data: rawAttendance } = await supabase
    .from("attendance_records")
    .select(`
      id,
      status,
      session_date,
      scanned_at,
      students (name, roll_no),
      subjects (name)
    `)
    .in("subject_id", subjectIds.length > 0 ? subjectIds : ["00000000-0000-0000-0000-000000000000"])
    .order("scanned_at", { ascending: false, nullsFirst: false })
    .limit(10)

  // Normalize Supabase join result (may return array or object for relations)
  const recentAttendance: AttendanceRecord[] = (rawAttendance || []).map((r) => ({
    id: r.id,
    status: r.status,
    session_date: r.session_date,
    scanned_at: r.scanned_at,
    students: Array.isArray(r.students) ? (r.students[0] ?? null) : r.students,
    subjects: Array.isArray(r.subjects) ? (r.subjects[0] ?? null) : r.subjects,
  }))

  const stats = [
    {
      title: "Total Subjects",
      value: subjectCount || 0,
      description: "Subjects you teach",
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Total Students",
      value: studentCount || 0,
      description: "Across your subjects",
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      title: "Present Today",
      value: presentToday || 0,
      description: "Students marked present",
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Sessions Today",
      value: totalToday || 0,
      description: "Attendance records",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your attendance management
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>
            Latest attendance records across your subjects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentAttendanceTable records={recentAttendance} />
        </CardContent>
      </Card>
    </div>
  )
}
