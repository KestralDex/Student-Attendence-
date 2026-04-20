"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Empty } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, BookOpen, Loader2 } from "lucide-react"

interface Subject {
  id: string
  name: string
  year: string
  teacher_id: string
  created_at: string
}

const yearLabels: Record<string, string> = {
  FE: "First Year",
  SE: "Second Year",
  TE: "Third Year",
  BE: "Fourth Year",
}

export function SubjectsClient({
  initialSubjects,
  teacherId,
}: {
  initialSubjects: Subject[]
  teacherId: string
}) {
  const router = useRouter()
  const [subjects, setSubjects] = useState(initialSubjects)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [year, setYear] = useState("")

  const handleAddSubject = async () => {
    if (!name || !year) return
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from("subjects")
      .insert({ name, year, teacher_id: teacherId })
      .select()
      .single()

    if (!error && data) {
      setSubjects([data, ...subjects])
      setName("")
      setYear("")
      setDialogOpen(false)
    }
    setLoading(false)
    router.refresh()
  }

  const handleDeleteSubject = async (id: string) => {
    setDeleteLoading(id)
    const supabase = createClient()
    const { error } = await supabase.from("subjects").delete().eq("id", id)

    if (!error) {
      setSubjects(subjects.filter((s) => s.id !== id))
    }
    setDeleteLoading(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
              <DialogDescription>
                Create a new subject to start tracking attendance
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="subject-name">Subject Name</FieldLabel>
                <Input
                  id="subject-name"
                  placeholder="e.g., Data Structures"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="year">Year</FieldLabel>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FE">First Year (FE)</SelectItem>
                    <SelectItem value="SE">Second Year (SE)</SelectItem>
                    <SelectItem value="TE">Third Year (TE)</SelectItem>
                    <SelectItem value="BE">Fourth Year (BE)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSubject} disabled={loading || !name || !year}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Subject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Subjects</CardTitle>
          <CardDescription>
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <Empty
              icon={BookOpen}
              title="No subjects yet"
              description="Add your first subject to start tracking attendance"
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject Name</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{yearLabels[subject.year]}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(subject.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSubject(subject.id)}
                          disabled={deleteLoading === subject.id}
                        >
                          {deleteLoading === subject.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
