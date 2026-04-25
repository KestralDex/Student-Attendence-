"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScanLine, Camera, CheckCircle, XCircle, AlertTriangle, BookOpen, Users, Clock, Loader2, Send, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Html5Qrcode } from "html5-qrcode"

interface Subject {
  id: string
  name: string
  year: string
}

interface Student {
  id: string
  name: string
  roll_no: string
  qr_code: string
}

interface AttendanceStatus {
  studentId: string
  status: "present" | "absent"
  scannedAt: string | null
}

interface ScanResult {
  success: boolean
  studentName: string
  rollNo: string
  message: string
}

export function QRScannerClient({ subjects }: { subjects: Subject[] }) {
  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedSubjectData, setSelectedSubjectData] = useState<Subject | null>(null)
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const { toast } = useToast()

  // Load students and attendance when subject changes
  useEffect(() => {
    if (!selectedSubject) {
      setStudents([])
      setAttendanceMap({})
      setSelectedSubjectData(null)
      return
    }

    const subject = subjects.find(s => s.id === selectedSubject)
    setSelectedSubjectData(subject || null)
    
    const loadStudentsForYear = async () => {
      setLoadingStudents(true)
      const supabase = createClient()
      
      // Get students for this year
      const { data: yearStudents } = await supabase
        .from("students")
        .select("id, name, roll_no, qr_code")
        .eq("year", subject?.year)
        .order("roll_no")

      if (yearStudents) {
        setStudents(yearStudents)
        
        // Get today's attendance for these students
        const today = new Date().toISOString().split("T")[0]
        const studentIds = yearStudents.map(s => s.id)
        
        const { data: attendanceRecords } = await supabase
          .from("attendance_records")
          .select("student_id, status, scanned_at")
          .eq("subject_id", selectedSubject)
          .eq("session_date", today)
          .in("student_id", studentIds)

        const newAttendanceMap: Record<string, AttendanceStatus> = {}
        yearStudents.forEach(student => {
          const record = attendanceRecords?.find(r => r.student_id === student.id)
          newAttendanceMap[student.id] = {
            studentId: student.id,
            status: record?.status === "present" ? "present" : "absent",
            scannedAt: record?.scanned_at || null
          }
        })
        setAttendanceMap(newAttendanceMap)
      }
      setLoadingStudents(false)
    }

    loadStudentsForYear()
  }, [selectedSubject, subjects])

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // ── Reset Session ────────────────────────────────────────────
  const resetSession = async () => {
    if (!selectedSubject || students.length === 0) return

    setResetting(true)
    const supabase = createClient()
    const today = new Date().toISOString().split("T")[0]
    const studentIds = students.map(s => s.id)

    // Delete today's attendance records for this subject from Supabase
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("subject_id", selectedSubject)
      .eq("session_date", today)
      .in("student_id", studentIds)

    if (error) {
      toast({
        title: "Reset Failed",
        description: "Could not reset attendance records. Please try again.",
        variant: "destructive",
      })
      setResetting(false)
      return
    }

    // Reset local state — all students back to absent + empty scannedAt
    const resetMap: Record<string, AttendanceStatus> = {}
    students.forEach(student => {
      resetMap[student.id] = {
        studentId: student.id,
        status: "absent",
        scannedAt: null,
      }
    })
    setAttendanceMap(resetMap)

    // Clear scan history and last scan
    setScanHistory([])
    setLastScan(null)

    toast({
      title: "Session Reset",
      description: `All ${students.length} students reset to Absent for today's session.`,
    })

    setResetting(false)
  }

  const handleQRScan = async (qrCode: string) => {
    if (!selectedSubject) return

    const supabase = createClient()

    // Find student by QR code
    const student = students.find(s => s.qr_code === qrCode)

    if (!student) {
      // Try database lookup for students not in current year
      const { data: dbStudent } = await supabase
        .from("students")
        .select("id, name, roll_no, year")
        .eq("qr_code", qrCode)
        .single()

      if (!dbStudent) {
        const result: ScanResult = {
          success: false,
          studentName: "Unknown",
          rollNo: qrCode,
          message: "Student not found with this QR code",
        }
        setLastScan(result)
        setScanHistory((prev) => [result, ...prev.slice(0, 9)])
        return
      }

      // Student found but from different year
      const result: ScanResult = {
        success: false,
        studentName: dbStudent.name,
        rollNo: dbStudent.roll_no,
        message: `Student is from ${dbStudent.year}, not ${selectedSubjectData?.year}`,
      }
      setLastScan(result)
      setScanHistory((prev) => [result, ...prev.slice(0, 9)])
      return
    }

    // Check if already marked present today
    if (attendanceMap[student.id]?.status === "present") {
      const result: ScanResult = {
        success: false,
        studentName: student.name,
        rollNo: student.roll_no,
        message: "Already marked present today",
      }
      setLastScan(result)
      setScanHistory((prev) => [result, ...prev.slice(0, 9)])
      return
    }

    // Upsert attendance record
    const today = new Date().toISOString().split("T")[0]
    const scannedAt = new Date().toISOString()
    
    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(
        {
          student_id: student.id,
          subject_id: selectedSubject,
          session_date: today,
          status: "present",
          scanned_at: scannedAt,
        },
        {
          onConflict: "student_id,subject_id,session_date",
        }
      )

    if (upsertError) {
      const result: ScanResult = {
        success: false,
        studentName: student.name,
        rollNo: student.roll_no,
        message: "Failed to record attendance",
      }
      setLastScan(result)
      setScanHistory((prev) => [result, ...prev.slice(0, 9)])
      return
    }

    // Update local state
    setAttendanceMap(prev => ({
      ...prev,
      [student.id]: {
        studentId: student.id,
        status: "present",
        scannedAt: scannedAt
      }
    }))

    const result: ScanResult = {
      success: true,
      studentName: student.name,
      rollNo: student.roll_no,
      message: "Attendance marked successfully",
    }
    setLastScan(result)
    setScanHistory((prev) => [result, ...prev.slice(0, 9)])
  }

  const startScanning = async () => {
    if (!selectedSubject) return

    try {
      scannerRef.current = new Html5Qrcode("qr-reader")
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleQRScan(decodedText)
        },
        () => {} // Ignore scan errors
      )
      setScanning(true)
    } catch (err) {
      console.error("Failed to start scanner:", err)
    }
  }

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
    }
    setScanning(false)
  }

  const presentCount = Object.values(attendanceMap).filter(a => a.status === "present").length
  const absentCount = students.length - presentCount

  const exportToN8N = async () => {
    if (!selectedSubjectData || students.length === 0) return

    setExporting(true)
    
    const today = new Date().toISOString().split("T")[0]
    const attendanceData = students.map(student => {
      const attendance = attendanceMap[student.id]
      return {
        studentId: student.id,
        studentName: student.name,
        rollNo: student.roll_no,
        status: attendance?.status || "absent",
        scannedAt: attendance?.scannedAt || null,
      }
    })

    const payload = {
      exportDate: new Date().toISOString(),
      sessionDate: today,
      subject: {
        id: selectedSubjectData.id,
        name: selectedSubjectData.name,
        year: selectedSubjectData.year,
      },
      summary: {
        totalStudents: students.length,
        presentCount,
        absentCount,
        attendancePercentage: students.length > 0 
          ? Math.round((presentCount / students.length) * 100) 
          : 0,
      },
      attendance: attendanceData,
    }

    try {
      const response = await fetch(`${window.location.origin}/dashboard/scan/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Export Successful",
          description: `Attendance data for ${selectedSubjectData.name} sent to n8n webhook`,
        })
      } else {
        const detail = result.details || result.error || `HTTP ${response.status}`
        throw new Error(detail)
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Could not send data to n8n webhook. Please try again.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
              <EmptyTitle>No subjects available</EmptyTitle>
              <EmptyDescription>Add subjects first before scanning attendance</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subject selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Select Subject
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel>Subject</FieldLabel>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a subject to take attendance" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(subject => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Scanner */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                QR Scanner
              </CardTitle>
              <CardDescription>
                {selectedSubject
                  ? "Point camera at student QR code"
                  : "Select a subject first"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div id="qr-reader" className="w-full" />
              <div className="flex gap-2">
                {!scanning ? (
                  <Button
                    onClick={startScanning}
                    disabled={!selectedSubject}
                    className="flex-1 gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanning}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Stop Scanning
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {lastScan && (
            <Card className={lastScan.success ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {lastScan.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">{lastScan.studentName}</p>
                    <p className="text-sm text-muted-foreground">{lastScan.rollNo}</p>
                    <p className="text-sm mt-1">{lastScan.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Attendance Stats */}
        <div className="space-y-4">
          {selectedSubjectData && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{students.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
              <CardDescription>Recent scans from this session</CardDescription>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ScanLine /></EmptyMedia>
                    <EmptyTitle>No scans yet</EmptyTitle>
                    <EmptyDescription>Start scanning to see history here</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-3">
                  {scanHistory.map((scan, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {scan.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{scan.studentName}</p>
                          <p className="text-xs text-muted-foreground">{scan.rollNo}</p>
                        </div>
                      </div>
                      <Badge variant={scan.success ? "default" : "secondary"}>
                        {scan.success ? "Present" : "Failed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Student Attendance List */}
      {selectedSubjectData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedSubjectData.year} Student List - {selectedSubjectData.name}
            </CardTitle>
            <CardDescription>
              Live attendance status for today&apos;s session
            </CardDescription>
            {/* ── Action Buttons ── */}
            <div className="pt-2 flex items-center gap-3 flex-wrap">
              {/* Export to n8n */}
              <Button
                onClick={exportToN8N}
                disabled={exporting || students.length === 0}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Export to n8n
              </Button>

              {/* Reset Session — with confirmation dialog */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={resetting || students.length === 0}
                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  >
                    {resetting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Reset Session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Today&apos;s Session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all attendance records for{" "}
                      <strong>{selectedSubjectData.name}</strong> for today&apos;s session.
                      All <strong>{presentCount} present</strong> students will be reset to{" "}
                      <strong>Absent</strong> and their scan times will be cleared.
                      <br /><br />
                      This action <strong>cannot be undone</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={resetSession}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Reset Session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Users /></EmptyMedia>
                  <EmptyTitle>No students found</EmptyTitle>
                  <EmptyDescription>{`No students registered for ${selectedSubjectData.year}. Import students first.`}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scanned At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student, index) => {
                      const attendance = attendanceMap[student.id]
                      const isPresent = attendance?.status === "present"
                      return (
                        <TableRow
                          key={student.id}
                          className={isPresent ? "bg-green-50" : ""}
                        >
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.roll_no}</TableCell>
                          <TableCell>
                            {isPresent ? (
                              <Badge className="bg-green-600 hover:bg-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Present
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Absent
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {attendance?.scannedAt ? (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(attendance.scannedAt).toLocaleTimeString()}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
