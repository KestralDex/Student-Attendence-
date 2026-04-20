"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Empty } from "@/components/ui/empty"
import { ClipboardList } from "lucide-react"

interface AttendanceRecord {
  id: string
  status: string
  session_date: string
  scanned_at: string | null
  students: { name: string; roll_no: string } | null
  subjects: { name: string } | null
}

export function RecentAttendanceTable({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return (
      <Empty
        icon={ClipboardList}
        title="No attendance records"
        description="Start scanning QR codes to record attendance"
      />
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Roll No</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-medium">
                {record.students?.name || "Unknown"}
              </TableCell>
              <TableCell>{record.students?.roll_no || "-"}</TableCell>
              <TableCell>{record.subjects?.name || "-"}</TableCell>
              <TableCell>
                <Badge
                  variant={record.status === "present" ? "default" : "secondary"}
                  className={
                    record.status === "present"
                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                      : "bg-red-100 text-red-700 hover:bg-red-100"
                  }
                >
                  {record.status}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(record.session_date).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {record.scanned_at
                  ? new Date(record.scanned_at).toLocaleTimeString()
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
