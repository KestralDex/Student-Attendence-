"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Download, FileSpreadsheet, Loader2, BookOpen } from "lucide-react"

interface Subject {
  id: string
  name: string
  year: string
}

interface StudentInfo {
  name: string
  roll_no: string
  email: string
  year: string
}

interface AttendanceRow {
  session_date: string
  status: string
  scanned_at: string | null
  students: StudentInfo | StudentInfo[] | null
}

function normalizeStudent(students: StudentInfo | StudentInfo[] | null): StudentInfo | null {
  if (!students) return null
  return Array.isArray(students) ? (students[0] ?? null) : students
}

export function ExportClient({ subjects }: { subjects: Subject[] }) {
  const [selectedSubject, setSelectedSubject] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!selectedSubject || !startDate || !endDate) return
    setLoading(true)

    const supabase = createClient()

    const { data: rawRecords, error } = await supabase
      .from("attendance_records")
      .select(`
        session_date,
        status,
        scanned_at,
        students (name, roll_no, email, year)
      `)
      .eq("subject_id", selectedSubject)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .order("session_date", { ascending: true })

    if (error || !rawRecords) {
      console.error("Export error:", error)
      setLoading(false)
      return
    }

    const records = (rawRecords as AttendanceRow[]).map((r) => ({
      ...r,
      students: normalizeStudent(r.students),
    }))

    // Generate CSV
    const subject = subjects.find((s) => s.id === selectedSubject)
    const headers = ["Date", "Student Name", "Roll No", "Email", "Year", "Status", "Scanned At"]
    const rows = records.map((record) => [
      record.session_date,
      record.students?.name || "",
      record.students?.roll_no || "",
      record.students?.email || "",
      record.students?.year || "",
      record.status,
      record.scanned_at ? new Date(record.scanned_at).toLocaleString() : "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `attendance_${subject?.name.replace(/\s+/g, "_")}_${startDate}_to_${endDate}.csv`
    link.click()

    setLoading(false)
  }

  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
          <EmptyTitle>No subjects available</EmptyTitle>
          <EmptyDescription>Add subjects first to export attendance data</EmptyDescription>
        </EmptyHeader>
      </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export Settings
          </CardTitle>
          <CardDescription>
            Configure your export parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Subject</FieldLabel>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} ({subject.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Start Date</FieldLabel>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>End Date</FieldLabel>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </FieldGroup>

          <Button
            className="w-full mt-6"
            onClick={handleExport}
            disabled={loading || !selectedSubject || !startDate || !endDate}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export to CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Information</CardTitle>
          <CardDescription>What&apos;s included in the export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">CSV Format</p>
                <p className="text-sm text-muted-foreground">
                  Compatible with Excel, Google Sheets, and other spreadsheet applications
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Included Data</p>
                <p className="text-sm text-muted-foreground">
                  Date, student name, roll number, email, year, attendance status, and scan timestamp
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Quick Tips:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Select a date range to filter records</li>
              <li>- Files are named with subject and date range</li>
              <li>- Large exports may take a moment to process</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
