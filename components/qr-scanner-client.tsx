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
import { Badge } from "@/components/ui/badge"
import { Empty } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScanLine, Camera, CheckCircle, XCircle, AlertTriangle, BookOpen, Users, Clock, Loader2, Send } from "lucide-react"
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
      const response = await fetch("/dashboard/scan/export", {
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
        throw new Error(result.error || `HTTP ${response.status}`)
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
          <Empty
            icon={BookOpen}
            title="No subjects available"
            description="Add subjects first before scanning attendance"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Scanner and Status Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                QR Scanner
              </CardTitle>
              <CardDescription>
                Select a subject and start scanning student QR codes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel>Select Subject</FieldLabel>
                <Select
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                  disabled={scanning}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject" />
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

              {/* Camera Container - Always visible */}
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black border-2 border-muted">
                {/* QR Reader container - must always be in DOM for html5-qrcode */}
                <div
                  id="qr-reader"
                  className="absolute inset-0 w-full h-full"
                  style={{ 
                    visibility: scanning ? 'visible' : 'hidden',
                  }}
                />
                
                {/* Placeholder when not scanning */}
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Camera preview will appear here
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Select a subject and click Start Scanning
                      </p>
                    </div>
                  </div>
                )}

                {/* Scanning overlay */}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-primary rounded-lg">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-lg" />
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Scanning...
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!scanning ? (
                  <Button
                    className="flex-1"
                    onClick={startScanning}
                    disabled={!selectedSubject}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={stopScanning}
                  >
                    Stop Scanning
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {lastScan && (
            <Card
              className={
                lastScan.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {lastScan.success ? (
                    <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">
                      {lastScan.studentName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Roll No: {lastScan.rollNo}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        lastScan.success ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {lastScan.message}
                    </p>
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
                <Empty
                  icon={ScanLine}
                  title="No scans yet"
                  description="Start scanning to see history here"
                />
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
                          <p className="text-xs text-muted-foreground">
                            {scan.rollNo}
                          </p>
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
            <div className="pt-2">
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
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <Empty
                icon={Users}
                title="No students found"
                description={`No students registered for ${selectedSubjectData.year}. Import students first.`}
              />
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
