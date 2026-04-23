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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Users, Loader2, QrCode, Upload, Download, FileSpreadsheet } from "lucide-react"
import { useRef } from "react"

interface Student {
  id: string
  name: string
  roll_no: string
  email: string | null
  year: string
  qr_code: string
  created_at: string
}

const yearLabels: Record<string, string> = {
  FE: "First Year",
  SE: "Second Year",
  TE: "Third Year",
  BE: "Fourth Year",
}

function generateQRCode(): string {
  return `STU-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

export function StudentsClient({
  initialStudents,
  years,
}: {
  initialStudents: Student[]
  years: string[]
}) {
  const router = useRouter()
  const [students, setStudents] = useState(initialStudents)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [rollNo, setRollNo] = useState("")
  const [email, setEmail] = useState("")
  const [year, setYear] = useState("")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importYear, setImportYear] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredStudents = filterYear === "all" 
    ? students 
    : students.filter(s => s.year === filterYear)

  const handleAddStudent = async () => {
    if (!name || !rollNo || !year) return
    setLoading(true)

    const supabase = createClient()
    const qrCode = generateQRCode()
    
    const { data, error } = await supabase
      .from("students")
      .insert({ name, roll_no: rollNo, email: email || null, year, qr_code: qrCode })
      .select()
      .single()

    if (!error && data) {
      setStudents([data, ...students])
      setName("")
      setRollNo("")
      setEmail("")
      setYear("")
      setDialogOpen(false)
    }
    setLoading(false)
    router.refresh()
  }

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !importYear) return

    setImportLoading(true)
    setImportResults(null)

    const text = await file.text()
    const lines = text.split("\n").filter(line => line.trim())
    
    // Skip header row if it exists
    const dataLines = lines[0].toLowerCase().includes("name") || lines[0].toLowerCase().includes("roll") 
      ? lines.slice(1) 
      : lines

    const supabase = createClient()
    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const line of dataLines) {
      const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""))
      if (parts.length < 2) continue

      const [name, rollNo, email] = parts
      if (!name || !rollNo) {
        failed++
        errors.push(`Invalid row: ${line}`)
        continue
      }

      const qrCode = `STU-${importYear}-${rollNo}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      const { data, error } = await supabase
        .from("students")
        .insert({ 
          name, 
          roll_no: rollNo, 
          email: email || null, 
          year: importYear, 
          qr_code: qrCode 
        })
        .select()
        .single()

      if (error) {
        failed++
        errors.push(`${rollNo}: ${error.message}`)
      } else if (data) {
        success++
        setStudents(prev => [data, ...prev])
      }
    }

    setImportResults({ success, failed, errors })
    setImportLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
    router.refresh()
  }

  const downloadTemplate = () => {
    const csv = "Name,Roll Number,Email\nJohn Doe,CS2024001,john@college.edu\nJane Smith,CS2024002,jane@college.edu"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "student_import_template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteStudent = async (id: string) => {
    setDeleteLoading(id)
    const supabase = createClient()
    const { error } = await supabase.from("students").delete().eq("id", id)

    if (!error) {
      setStudents(students.filter((s) => s.id !== id))
    }
    setDeleteLoading(null)
    router.refresh()
  }

  if (years.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Users /></EmptyMedia>
          <EmptyTitle>No subjects assigned</EmptyTitle>
          <EmptyDescription>Add subjects first to see students for those year groups</EmptyDescription>
        </EmptyHeader>
      </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {yearLabels[y]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={importDialogOpen} onOpenChange={(open) => {
          setImportDialogOpen(open)
          if (!open) setImportResults(null)
        }}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Import Students from CSV
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file with student data for a specific year
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field>
                <FieldLabel>Select Year</FieldLabel>
                <Select value={importYear} onValueChange={setImportYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose year for imported students" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {yearLabels[y]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  CSV format: Name, Roll Number, Email (optional)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  disabled={!importYear || importLoading}
                  className="hidden"
                  id="csv-upload"
                />
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                  <Button
                    size="sm"
                    disabled={!importYear || importLoading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {importLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Select CSV File
                  </Button>
                </div>
              </div>

              {importResults && (
                <div className={`p-4 rounded-lg ${importResults.failed > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                  <p className="font-medium">
                    Import Complete: {importResults.success} added, {importResults.failed} failed
                  </p>
                  {importResults.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                      {importResults.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="truncate">{err}</li>
                      ))}
                      {importResults.errors.length > 5 && (
                        <li>...and {importResults.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Register a new student with a unique QR code
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="student-name">Full Name</FieldLabel>
                <Input
                  id="student-name"
                  placeholder="e.g., John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="roll-no">Roll Number</FieldLabel>
                <Input
                  id="roll-no"
                  placeholder="e.g., CS2024001"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-email">Email (Optional)</FieldLabel>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="e.g., john@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-year">Year</FieldLabel>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {yearLabels[y]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStudent} disabled={loading || !name || !rollNo || !year}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Student
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>
            {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} 
            {filterYear !== "all" ? ` in ${yearLabels[filterYear]}` : " total"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Users /></EmptyMedia>
          <EmptyTitle>No students found</EmptyTitle>
          <EmptyDescription>Add students to start tracking attendance</EmptyDescription>
        </EmptyHeader>
      </Empty>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.roll_no}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{yearLabels[student.year]}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1 w-fit">
                          <QrCode className="h-3 w-3" />
                          {student.qr_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteStudent(student.id)}
                          disabled={deleteLoading === student.id}
                        >
                          {deleteLoading === student.id ? (
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
