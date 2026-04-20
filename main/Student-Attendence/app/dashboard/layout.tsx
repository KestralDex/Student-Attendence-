import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardNav teacher={teacher} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
