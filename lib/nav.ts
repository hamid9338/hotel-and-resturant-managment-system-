import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BedDouble,
  CalendarRange,
  Users,
  Sparkles,
  UtensilsCrossed,
  ClipboardList,
  ScanLine,
  UserCog,
  ShieldAlert,
  BellRing,
  Settings,
  RefreshCw,
  BarChart3,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string[]; section: string };

// Sections/pages here are exactly what Milestone 1 actually implements —
// Inventory/Purchasing/Finance/KDS etc. are Milestone 2 and deliberately
// don't appear here yet rather than linking to something that isn't built.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "" },
  { href: "/hotel", label: "Rooms", icon: BedDouble, section: "Hotel", permission: ["hotel.view", "hotel.view_cleaning"] },
  { href: "/hotel/bookings", label: "Reservations", icon: CalendarRange, section: "Hotel", permission: ["hotel.view"] },
  { href: "/hotel/guests", label: "Guests", icon: Users, section: "Hotel", permission: ["hotel.view"] },
  {
    href: "/housekeeping",
    label: "Housekeeping",
    icon: Sparkles,
    section: "Hotel",
    permission: ["hotel.view", "hotel.view_cleaning"],
  },
  {
    href: "/restaurant",
    label: "POS",
    icon: UtensilsCrossed,
    section: "Restaurant",
    permission: ["restaurant.create_order", "restaurant.view"],
  },
  { href: "/restaurant/orders", label: "Orders", icon: ClipboardList, section: "Restaurant", permission: ["restaurant.view"] },
  { href: "/ocr", label: "Bill Scanner", icon: ScanLine, section: "AI", permission: ["ocr.view", "ocr.scan"] },
  { href: "/reports", label: "Reports", icon: BarChart3, section: "Reports", permission: ["reports.view"] },
  { href: "/staff", label: "Staff", icon: UserCog, section: "Admin", permission: ["staff.view_all"] },
  { href: "/staff/audit", label: "Audit Log", icon: ShieldAlert, section: "Admin", permission: ["audit.view"] },
  { href: "/staff/alerts", label: "Alerts", icon: BellRing, section: "Admin", permission: ["alerts.view"] },
  { href: "/settings", label: "Settings", icon: Settings, section: "Admin", permission: ["settings.view"] },
  { href: "/sync", label: "Sync Status", icon: RefreshCw, section: "Admin", permission: ["sync.view"] },
];
