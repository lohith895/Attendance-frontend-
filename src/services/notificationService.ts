import { sendWhatsappAlert } from "@/services/faceRecognitionApi";

export interface AppNotification {
  id: string;
  userId?: string; // student auth user_id
  studentId?: string; // student table id
  type: "attendance" | "warning" | "sms" | "email";
  title: string;
  message: string;
  recipient: "student" | "parent" | "teacher" | "admin";
  recipientName: string;
  contactInfo: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = "app_notifications";

export const getNotifications = (): AppNotification[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    // Populate with some default dummy notifications for visual excellence
    const defaults: AppNotification[] = [
      {
        id: "mock-1",
        type: "warning",
        title: "Low Attendance Warning",
        message: "Your attendance in Computer Networks (CN-302) is 71.4%, which is below the 75% eligibility threshold. Please attend upcoming classes to avoid registration issues.",
        recipient: "student",
        recipientName: "Varsha",
        contactInfo: "varsha@student.com",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        read: false,
      },
      {
        id: "mock-2",
        type: "sms",
        title: "Parent SMS Sent",
        message: "[SMS Alert] Dear Parent, Amrutha was absent for Artificial Intelligence class on 16-06-2026. Current Attendance: 68.7%.",
        recipient: "parent",
        recipientName: "Amrutha's Parent",
        contactInfo: "+91 9876543210",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
        read: true,
      },
      {
        id: "mock-3",
        type: "attendance",
        title: "Attendance Marked Present",
        message: "You have been marked Present in Machine Learning (ML-301) by Prof. Parameshwar.",
        recipient: "student",
        recipientName: "Charmin SK",
        contactInfo: "charmin@student.com",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
        read: true,
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(data);
};

export const addNotification = (notif: Omit<AppNotification, "id" | "timestamp" | "read">): AppNotification => {
  const list = getNotifications();
  const newNotif: AppNotification = {
    ...notif,
    id: `notif-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  list.unshift(newNotif);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  
  // Dispatch a custom event to notify React components of real-time update
  window.dispatchEvent(new CustomEvent("new_notification", { detail: newNotif }));
  
  return newNotif;
};

export const markAllNotificationsAsRead = () => {
  const list = getNotifications();
  const updated = list.map(n => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("new_notification"));
};

export const markNotificationAsRead = (id: string) => {
  const list = getNotifications();
  const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("new_notification"));
};

export const clearNotifications = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("new_notification"));
};

interface TriggerAlertsParams {
  subjectName: string;
  subjectCode: string;
  teacherPhone?: string;
  detectedStudents: Array<{
    id: string;
    rollNumber: string;
    fullName: string;
    status: "present" | "absent" | "late";
    email?: string;
    phone?: string;
  }>;
  allStudentsInClass: Array<{
    id: string;
    roll_number: string;
    full_name: string;
    email: string | null;
    phone_number: string | null;
    user_id?: string | null;
  }>;
}

export const triggerAttendanceAlerts = ({
  subjectName,
  subjectCode,
  teacherPhone,
  detectedStudents,
  allStudentsInClass
}: TriggerAlertsParams) => {
  const tPhone = teacherPhone || "+91 99999 99999";
  // Loop through all students to see who is present vs absent
  allStudentsInClass.forEach(student => {
    const detected = detectedStudents.find(d => d.id === student.id);
    const status = detected ? detected.status : "absent";
    
    // Send alert to student
    if (status === "present" || status === "late") {
      addNotification({
        studentId: student.id,
        userId: student.user_id || undefined,
        type: "attendance",
        title: "Class Attendance Recorded",
        message: `You were marked ${status === "present" ? "Present" : "Late"} in ${subjectName} (${subjectCode}) class.`,
        recipient: "student",
        recipientName: student.full_name,
        contactInfo: student.email || `${student.roll_number.toLowerCase()}@attendance.edu`,
      });
    } else {
      // Absent student alert
      addNotification({
        studentId: student.id,
        userId: student.user_id || undefined,
        type: "warning",
        title: "Absent Alert",
        message: `You were marked Absent in ${subjectName} (${subjectCode}) class today. Please ensure you attend the next class.`,
        recipient: "student",
        recipientName: student.full_name,
        contactInfo: student.email || `${student.roll_number.toLowerCase()}@attendance.edu`,
      });

      // Parent SMS Alert
      addNotification({
        studentId: student.id,
        userId: student.user_id || undefined,
        type: "sms",
        title: "Parent SMS Notification Triggered",
        message: `[SMS Alert] Dear Parent, ${student.full_name} (${student.roll_number}) was absent for ${subjectName} (${subjectCode}) today.`,
        recipient: "parent",
        recipientName: `${student.full_name}'s Parent`,
        contactInfo: student.phone_number || "+91 XXXXX XXXXX",
      });

      // Dispatch real or simulated WhatsApp alert via Twilio on the backend
      const parentPhone = student.phone_number || "+91 88888 88888";
      sendWhatsappAlert({
        teacher_phone: tPhone,
        parent_phone: parentPhone,
        student_name: student.full_name,
        subject_name: subjectName,
        subject_code: subjectCode,
      }).catch((err) => {
        console.error("Failed to trigger backend WhatsApp Twilio notification:", err);
      });
    }
  });
};
