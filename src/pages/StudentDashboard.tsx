import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  AppNotification,
} from "@/services/notificationService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Activity,
  Bell,
  Mail,
  Send,
} from "lucide-react";
import { SubjectMapping } from "@/components/student/SubjectMapping";

interface AttendanceRecord {
  id: string;
  status: string;
  created_at: string;
  class: {
    class_date: string;
    start_time: string;
    end_time: string;
    subject: {
      name: string;
      code: string;
    };
  };
}

interface SubjectStats {
  name: string;
  code: string;
  total: number;
  attended: number;
  percentage: number;
}

const CHART_COLORS = {
  present: "hsl(142, 76%, 36%)",
  absent: "hsl(0, 84%, 60%)",
  late: "hsl(38, 92%, 50%)",
  primary: "hsl(250, 89%, 64%)",
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({
    totalClasses: 0,
    attended: 0,
    missed: 0,
    percentage: 0,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchStudentNotifications = (email?: string, studentId?: string) => {
    const all = getNotifications();
    const filtered = all.filter(
      (n) =>
        n.recipient === "student" &&
        (n.userId === user?.id ||
          (email && n.contactInfo?.toLowerCase() === email.toLowerCase()) ||
          (studentId && n.studentId === studentId))
    );
    setNotifications(filtered);
  };

  useEffect(() => {
    if (studentData) {
      fetchStudentNotifications(studentData.email || undefined, studentData.id);
    }
  }, [studentData]);

  useEffect(() => {
    const handleNewNotif = () => {
      if (studentData) {
        fetchStudentNotifications(studentData.email || undefined, studentData.id);
      }
    };
    window.addEventListener("new_notification", handleNewNotif);
    return () => {
      window.removeEventListener("new_notification", handleNewNotif);
    };
  }, [studentData]);

  useEffect(() => {
    if (user) fetchStudentData();
  }, [user]);

  const studentSelectQuery = `
    id, full_name, roll_number, email, phone_number,
    sections (
      name,
      years (
        name,
        departments (name, code)
      )
    )
  `;

  const fetchStudentData = async () => {
    try {
      // Primary lookup: by linked user_id
      let { data: student } = await supabase
        .from("students")
        .select(studentSelectQuery)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!student && user!.email) {
        // Fallback: auth user exists but edge function failed to link user_id to the
        // student record. Try finding the record by the generated email
        // (roll_number@attendance.edu) and auto-repair the link.
        const { data: byEmail } = await supabase
          .from("students")
          .select("id, email")
          .eq("email", user!.email)
          .is("user_id", null)
          .maybeSingle();

        if (byEmail) {
          await supabase
            .from("students")
            .update({ user_id: user!.id })
            .eq("id", byEmail.id);

          // Re-fetch with full joins after linking
          const { data: fixed } = await supabase
            .from("students")
            .select(studentSelectQuery)
            .eq("user_id", user!.id)
            .maybeSingle();

          student = fixed;
        }
      }

      if (!student) {
        setLoading(false);
        return;
      }

      setStudentData(student);

      // Get all attendance records for this student
      const { data: attendance } = await supabase
        .from("attendance")
        .select(`
          id, status, created_at,
          classes (
            class_date, start_time, end_time,
            subjects (name, code)
          )
        `)
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });

      const records = (attendance || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        created_at: a.created_at,
        class: {
          class_date: a.classes?.class_date || "",
          start_time: a.classes?.start_time || "",
          end_time: a.classes?.end_time || "",
          subject: {
            name: a.classes?.subjects?.name || "Unknown",
            code: a.classes?.subjects?.code || "",
          },
        },
      }));

      setAttendanceRecords(records);

      // Calculate overall stats
      const totalClasses = records.length;
      const attended = records.filter((r) => r.status === "present").length;
      const missed = totalClasses - attended;
      const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 0;
      setOverallStats({ totalClasses, attended, missed, percentage });

      // Calculate per-subject stats
      const subjectMap = new Map<string, { name: string; code: string; total: number; attended: number }>();
      for (const r of records) {
        const key = r.class.subject.code;
        const existing = subjectMap.get(key) || { name: r.class.subject.name, code: key, total: 0, attended: 0 };
        existing.total++;
        if (r.status === "present") existing.attended++;
        subjectMap.set(key, existing);
      }
      setSubjectStats(
        Array.from(subjectMap.values()).map((s) => ({
          ...s,
          percentage: s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching student data:", error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: "Present", value: overallStats.attended, color: CHART_COLORS.present },
    { name: "Absent", value: overallStats.missed, color: CHART_COLORS.absent },
  ].filter((d) => d.value > 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!studentData) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">No Student Record Found</h2>
          <p className="mb-2">Your login account is not linked to any student record.</p>
          {user?.email && (
            <p className="text-sm mb-4">
              You are logged in as <span className="font-mono font-medium text-foreground">{user.email}</span>
            </p>
          )}
          <p className="text-sm">Please ask your teacher to link your account, or try
            {" "}<button className="underline text-primary" onClick={fetchStudentData}>refreshing</button>.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="space-y-1">
          <h1 className="text-3xl font-display font-bold">
            Welcome, {studentData.full_name}
          </h1>
          <p className="text-muted-foreground">
            {studentData.roll_number} · {(studentData as any).sections?.years?.departments?.name} · {(studentData as any).sections?.years?.name} · Section {(studentData as any).sections?.name}
          </p>
        </motion.div>

        {/* Critical Low Attendance Banner */}
        {overallStats.percentage < 75 && overallStats.totalClasses > 0 && (
          <motion.div variants={itemVariants} className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 shadow-lg shadow-destructive/5">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm sm:text-base">Critical Attendance Status Alert</p>
              <p className="text-xs sm:text-sm text-destructive/95 mt-0.5 leading-relaxed">
                Your overall attendance is currently <strong className="font-bold">{overallStats.percentage}%</strong>, which is below the required <strong className="font-bold">75%</strong> threshold. Please attend upcoming classes to avoid academic eligibility restrictions.
              </p>
            </div>
          </motion.div>
        )}

        {/* Notifications and Alerts Card */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent" />
                  My Alerts & Notifications
                </CardTitle>
                <CardDescription>
                  Recent real-time attendance alerts and academic warnings.
                </CardDescription>
              </div>
              {notifications.filter(n => !n.read).length > 0 && (
                <Badge className="bg-accent text-accent-foreground text-[10px] sm:text-xs">
                  {notifications.filter(n => !n.read).length} Unread
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No recent alerts or warnings</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-colors flex items-start gap-3",
                        !notif.read ? "border-accent/30 bg-accent/5" : "border-border/50 bg-secondary/10"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                        notif.type === "warning" && "bg-yellow-500/10 text-yellow-600",
                        notif.type === "attendance" && "bg-green-500/10 text-green-600"
                      )}>
                        {notif.type === "warning" ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={cn("text-xs font-semibold", !notif.read ? "text-foreground font-bold" : "text-muted-foreground")}>
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(notif.timestamp).toLocaleDateString()} at {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Classes" value={overallStats.totalClasses} icon={Calendar} variant="default" />
          <StatCard title="Classes Attended" value={overallStats.attended} icon={CheckCircle2} variant="success" />
          <StatCard title="Classes Missed" value={overallStats.missed} icon={AlertTriangle} variant="danger" />
          <StatCard
            title="Attendance %"
            value={`${overallStats.percentage}%`}
            icon={overallStats.percentage >= 80 ? TrendingUp : TrendingDown}
            variant={overallStats.percentage >= 80 ? "success" : overallStats.percentage >= 70 ? "warning" : "danger"}
          />
        </motion.div>

        {/* Subject Mapping */}
        <motion.div variants={itemVariants}>
          <SubjectMapping />
        </motion.div>

        {/* Attendance Predictor & Projections */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/80 shadow-md bg-gradient-to-br from-card to-secondary/10 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500 animate-pulse" />
                Attendance Predictor & Projections
              </CardTitle>
              <CardDescription>
                Smart predictive analytics to forecast your eligibility status at semester end.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Status Indicator */}
                <div className="flex flex-col justify-center items-center p-4 rounded-xl bg-background/40 border border-border/50 text-center">
                  <span className="text-sm text-muted-foreground">Current Standing</span>
                  <span className={cn(
                    "text-4xl font-display font-extrabold mt-1 tracking-tight",
                    overallStats.percentage >= 80 ? "text-green-500" : overallStats.percentage >= 75 ? "text-amber-500" : "text-destructive"
                  )}>
                    {overallStats.percentage}%
                  </span>
                  <Badge className={cn(
                    "mt-2 font-semibold",
                    overallStats.percentage >= 80 ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : 
                    overallStats.percentage >= 75 ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : 
                    "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  )}>
                    {overallStats.percentage >= 80 ? "Safe Zone" : overallStats.percentage >= 75 ? "Warning Zone" : "Critical Ineligible"}
                  </Badge>
                </div>

                {/* Projections */}
                <div className="space-y-4 col-span-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-3 rounded-lg border border-border/50 bg-background/25">
                      <div className="text-xs text-muted-foreground">Best Case Projection</div>
                      <div className="text-xl font-bold mt-1 text-foreground">
                        {Math.round(((overallStats.attended + 15) / (overallStats.totalClasses + 15)) * 100)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Assumes attending next 15 scheduled classes</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border/50 bg-background/25">
                      <div className="text-xs text-muted-foreground">Maintain Pace</div>
                      <div className="text-xl font-bold mt-1 text-foreground">{overallStats.percentage}%</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Assumes matching present overall rate</div>
                    </div>
                  </div>

                  {/* Early Warning Message & Action */}
                  <div className={cn(
                    "p-4 rounded-lg border text-sm leading-relaxed",
                    overallStats.percentage >= 75 
                      ? "border-green-500/20 bg-green-500/5 text-muted-foreground"
                      : "border-destructive/20 bg-destructive/5 text-muted-foreground"
                  )}>
                    {overallStats.percentage < 75 ? (
                      <div>
                        <span className="font-semibold text-destructive flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="h-4 w-4" /> Action Required
                        </span>
                        You must attend at least <strong className="text-foreground font-bold">{Math.max(0, Math.ceil(3 * overallStats.totalClasses - 4 * overallStats.attended))} consecutive classes</strong> without absence to recover your overall attendance to the <strong className="text-foreground font-bold">75%</strong> threshold.
                      </div>
                    ) : (
                      <div>
                        <span className="font-semibold text-green-500 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-4 w-4" /> Safe Standing
                        </span>
                        You are in good academic standing. You can afford to miss up to <strong className="text-foreground font-bold">{Math.max(0, Math.floor((4 * overallStats.attended) / 3 - overallStats.totalClasses))} classes</strong> before falling below the 75% eligibility mark.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Row */}
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Overall Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Overall Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subject-wise Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Subject-wise Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {subjectStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="code" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, "Attendance"]} />
                      <Bar dataKey="percentage" name="Attendance" radius={[4, 4, 0, 0]}>
                        {subjectStats.map((s, i) => (
                          <Cell
                            key={i}
                            fill={s.percentage >= 80 ? CHART_COLORS.present : s.percentage >= 70 ? CHART_COLORS.late : CHART_COLORS.absent}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subject-wise Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subject-wise Breakdown</CardTitle>
              <CardDescription>Your attendance in each subject</CardDescription>
            </CardHeader>
            <CardContent>
              {subjectStats.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No attendance records yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Attended</TableHead>
                      <TableHead className="text-center">Attendance %</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectStats.map((s) => (
                      <TableRow key={s.code}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-sm text-muted-foreground">{s.code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{s.total}</TableCell>
                        <TableCell className="text-center">{s.attended}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 justify-center">
                            <Progress value={s.percentage} className="h-2 w-20" />
                            <span className="text-sm font-medium">{s.percentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge variant={s.percentage >= 80 ? "safe" : s.percentage >= 70 ? "warning" : "risk"}>
                            {s.percentage >= 80 ? "Safe" : s.percentage >= 70 ? "Warning" : "At Risk"}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Attendance History */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Attendance History
              </CardTitle>
              <CardDescription>Your last 20 attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceRecords.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No attendance records yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.slice(0, 20).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.class.class_date
                            ? new Date(r.class.class_date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{r.class.subject.name}</span>
                          <span className="text-muted-foreground ml-2 text-sm">({r.class.subject.code})</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.class.start_time} - {r.class.end_time}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge variant={r.status === "present" ? "safe" : "risk"}>
                            {r.status === "present" ? "Present" : "Absent"}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
