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
import { Empty } from "@/components/ui/empty"
import { Download, FileSpreadsheet, Loader2, BookOpen, ArrowUpRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Subject {
  id: string
  name: string
  year: string
}

export function ExportClient({ subjects }: { subjects: Subject[] }) {
  const [selectedSubject, setSelectedSubject] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [n8nLoading, setN8nLoading] = useState(false)
  const { toast } = useToast()

  const fetchAttendanceRecords = async (subjectId: string, startDate: string, endDate: string) => {
    const supabase = createClient()
    const { data: records, error } = await supabase
      .from("attendance_records")
      .select(`
        session_date,
        status,
        scanned_at,
        students (name, roll_no, email, year)
      `)
      .eq("subject_id", subjectId)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .order("session_date", { ascending: true })

    if (error || !records) {
      toast({
        title: "Export failed",
        description: error?.message || "Failed to fetch records",
        variant: "destructive",
      })
      return null
    }

    return records
  }

  const handleExport = async () => {
    if (!selectedSubject || !startDate || !endDate) return
    setLoading(true)

    const records = await fetchAttendanceRecords(selectedSubject, startDate, endDate)
    if (!records) {
      setLoading(false)
      return
    }

    // Generate CSV
    const subject = subjects.find((s) => s.id === selectedSubject)
    const headers = ["Date", "Student Name", "Roll No", "Email", "Year", "Status", "Scanned At"]
    const rows = records.map((record: any) => [
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

  const handleN8nExport = async () => {
    if (!selectedSubject || !startDate || !endDate) return
    setN8nLoading(true)

    const records = await fetchAttendanceRecords(selectedSubject, startDate, endDate)
    if (!records) {
      setN8nLoading(false)
      return
    }

    try {
      const subject = subjects.find((s) => s.id === selectedSubject)
      const payload = {
        subject: subject?.name || "Unknown",
        dateRange: { start: startDate, end: endDate },
        records: records.map((record) => ({
          session_date: record.session_date,
          student_name: record.students?.name || "",
          roll_no: record.students?.roll_no || "",
          email: record.students?.email || "",
          year: record.students?.year || "",
          status: record.status,
          scanned_at: record.scanned_at ? new Date(record.scanned_at).toLocaleString() : null,
        })),
      }

      const response = await fetch("https://shete1319.app.n8n.cloud/webhook-test/76664403-3b71-4a00-91d9-ae89debfaee3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        uiToast({
          title: "Success",
          description: "Data sent to n8n successfully",
        })
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      uiToast({
        title: "n8n Export failed",
        description: err instanceof Error ? err.message : "Failed to send to n8n",
        variant: "destructive",
      })
    } finally {
      setN8nLoading(false)
    }
  }

  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <Empty
            icon={BookOpen}
            title="No subjects available"
            description="Add subjects first to export attendance data"
          />
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

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              className="flex-1"
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
            <Button
              className="flex-1"
              variant="outline"
              onClick={handleN8nExport}
              disabled={n8nLoading || !selectedSubject || !startDate || !endDate}
            >
              {n8nLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpRight className="mr-2 h-4 w-4" />
              )}
              Export to n8n
            </Button>
          </div>
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
