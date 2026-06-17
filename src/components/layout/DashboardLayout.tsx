import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { APP_SHORT_TITLE } from "@/lib/appConfig";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Building2,
  Calendar,
  ChevronRight,
  Bell,
} from "lucide-react";
import { CollegeHeader } from "@/components/layout/CollegeHeader";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  AppNotification,
} from "@/services/notificationService";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: Array<"admin" | "teacher" | "student">;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "teacher"] },
  { label: "My Dashboard", href: "/student-dashboard", icon: LayoutDashboard, roles: ["student"] },
  { label: "Departments", href: "/departments", icon: Building2, roles: ["admin"] },
  { label: "Subjects", href: "/subjects", icon: Calendar, roles: ["admin"] },
  { label: "Teachers", href: "/teachers", icon: Users, roles: ["admin"] },
  { label: "Students", href: "/students", icon: GraduationCap, roles: ["admin", "teacher"] },
  { label: "Face Training", href: "/face-training", icon: UserPlus, roles: ["teacher"] },
  { label: "Bulk Upload", href: "/bulk-upload", icon: ClipboardCheck, roles: ["teacher"] },
  { label: "Classes", href: "/classes", icon: Calendar, roles: ["admin", "teacher"] },
  { label: "Take Attendance", href: "/attendance", icon: ClipboardCheck, roles: ["teacher"] },
  { label: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin", "teacher"] },
  
  { label: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchAndFilterNotifications = () => {
    const all = getNotifications();
    if (role === "student" && user) {
      setNotifications(
        all.filter(
          (n) =>
            n.recipient === "student" &&
            (n.userId === user.id || n.contactInfo?.toLowerCase() === user.email?.toLowerCase())
        )
      );
    } else {
      setNotifications(all);
    }
  };

  useEffect(() => {
    fetchAndFilterNotifications();

    const handleNewNotif = () => {
      fetchAndFilterNotifications();
    };

    window.addEventListener("new_notification", handleNewNotif);
    return () => {
      window.removeEventListener("new_notification", handleNewNotif);
    };
  }, [user, role]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const renderNotificationsDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-secondary">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 z-50">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-accent hover:text-accent p-0"
              onClick={markAllNotificationsAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={cn(
                  "p-4 border-b flex flex-col items-start gap-1 cursor-pointer transition-colors focus:bg-secondary text-left w-full",
                  !notif.read && "bg-accent/5"
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  markNotificationAsRead(notif.id);
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium capitalize",
                      notif.type === "warning" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                      notif.type === "sms" && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                      notif.type === "attendance" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                      notif.type === "email" && "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                    )}
                  >
                    {notif.type === "sms" ? "Parent SMS" : notif.type === "email" ? "Student Email" : notif.type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className={cn("text-xs font-semibold mt-1", !notif.read ? "text-foreground font-bold" : "text-muted-foreground")}>
                  {notif.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words w-full">
                  {notif.message}
                </p>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        transition={{ duration: 0.2 }}
        className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display font-bold leading-tight text-sidebar-foreground text-sm">
                    {APP_SHORT_TITLE}
                  </h1>
                  <p className="text-xs text-sidebar-foreground/60">
                    Intelligent Technologies
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                sidebarOpen && "rotate-180"
              )}
            />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                  "hover:bg-sidebar-accent",
                  isActive && "bg-sidebar-accent text-sidebar-primary font-medium"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence mode="wait">
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                  "text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                    {getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
                <AnimatePresence mode="wait">
                  {sidebarOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-medium truncate">{user?.email}</p>
                      <p className="text-xs text-sidebar-foreground/60 capitalize">
                        {role || "User"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-foreground text-sm sm:text-base">
            {APP_SHORT_TITLE}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {renderNotificationsDropdown()}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "-100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "-100%" }}
            className="lg:hidden fixed inset-0 top-16 z-40 bg-background"
          >
            <nav className="p-4 space-y-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      "text-foreground/70 hover:text-foreground hover:bg-secondary",
                      isActive && "bg-secondary text-primary font-medium"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign out</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:pt-0 pt-16 overflow-auto flex flex-col">
        <CollegeHeader showSubtitle={false} />
        
        {/* Navigation Toolbar */}
        <div className="px-6 lg:px-8 py-3 bg-card border-b border-border/40 flex items-center justify-end gap-4 shadow-sm">
          <span className="text-xs text-muted-foreground mr-auto hidden sm:inline capitalize">
            Logged in as {role}: <span className="font-semibold">{user?.email}</span>
          </span>
          {renderNotificationsDropdown()}
        </div>

        <div className="p-6 lg:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}
