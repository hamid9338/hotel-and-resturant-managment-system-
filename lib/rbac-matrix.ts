/**
 * The single source of truth for roles and permissions — imported by
 * prisma/seed.ts (to populate the Role/Permission/RolePermission tables) and
 * by tests/rbac.test.ts (to catch config drift, e.g. a role referencing a
 * permission key that was renamed or removed, without needing a database).
 *
 * Actual enforcement at runtime reads from the database
 * (lib/auth/permissions.ts), not from this file directly — this is what
 * seeds that data, and what a future roles-and-permissions admin UI
 * (Milestone 3) would edit instead of this file.
 */

export type PermissionDef = { key: string; module: string; description: string };
export type RoleDef = { name: string; label: string; permissions: string[] };

// Dot-notation "module.action" keys, enforced server-side by
// lib/auth/permissions.ts on every sensitive route.
export const PERMISSIONS: PermissionDef[] = [
  { key: "hotel.view", module: "hotel", description: "View rooms and bookings" },
  { key: "hotel.create_booking", module: "hotel", description: "Create a reservation" },
  { key: "hotel.checkin", module: "hotel", description: "Check a guest in" },
  { key: "hotel.checkout", module: "hotel", description: "Check a guest out" },
  { key: "hotel.cancel_booking", module: "hotel", description: "Cancel a reservation" },
  { key: "hotel.discount", module: "hotel", description: "Apply a discount to a booking" },
  { key: "hotel.update_room_status", module: "hotel", description: "Change a room's operational status" },
  { key: "hotel.view_cleaning", module: "hotel", description: "View rooms awaiting cleaning" },
  { key: "restaurant.view", module: "restaurant", description: "View tables, menu and orders" },
  { key: "restaurant.create_order", module: "restaurant", description: "Place a restaurant order" },
  { key: "restaurant.update_order_status", module: "restaurant", description: "Progress an order's status" },
  { key: "restaurant.cancel_order", module: "restaurant", description: "Cancel a restaurant order" },
  { key: "restaurant.bill_order", module: "restaurant", description: "Settle an order's bill" },
  { key: "restaurant.manage_menu", module: "restaurant", description: "Edit menu prices and availability" },
  { key: "ocr.view", module: "ocr", description: "View scanned bills" },
  { key: "ocr.scan", module: "ocr", description: "Scan a new bill" },
  { key: "ocr.verify", module: "ocr", description: "Verify/correct a scanned bill" },
  { key: "staff.view", module: "staff", description: "View own-role staff list" },
  { key: "staff.view_all", module: "staff", description: "View all staff" },
  { key: "staff.create", module: "staff", description: "Create a staff account" },
  { key: "staff.edit", module: "staff", description: "Edit a staff account" },
  { key: "reports.view", module: "reports", description: "View reports and dashboard" },
  { key: "audit.view", module: "audit", description: "View the audit log" },
  { key: "alerts.view", module: "alerts", description: "View security alerts" },
  { key: "alerts.resolve", module: "alerts", description: "Resolve a security alert" },
  { key: "settings.view", module: "settings", description: "View business settings" },
  { key: "settings.edit", module: "settings", description: "Edit business settings" },
  { key: "sync.view", module: "sync", description: "View the offline sync queue" },
  { key: "sync.manage", module: "sync", description: "Manage/retry sync operations" },
  { key: "inventory.view", module: "inventory", description: "View stock items and movement history" },
  { key: "inventory.manage", module: "inventory", description: "Create/edit items, suppliers, and purchase orders" },
  { key: "inventory.adjust_stock", module: "inventory", description: "Manually correct a stock count" },
  { key: "finance.view", module: "finance", description: "View expenses and cash-shift history" },
  { key: "finance.log_expense", module: "finance", description: "Create an expense record" },
  { key: "finance.approve_expense", module: "finance", description: "Approve or reject a pending expense" },
  { key: "finance.manage_cash_shift", module: "finance", description: "Open and close a cash-register shift" },
  { key: "finance.refund", module: "finance", description: "Refund a settled bill or booking" },
  { key: "hotel.manage_maintenance", module: "hotel", description: "Assign and resolve maintenance tickets" },
];

const ALL_KEYS = PERMISSIONS.map((p) => p.key);

export const ROLES: RoleDef[] = [
  { name: "owner", label: "Owner", permissions: ALL_KEYS },
  {
    name: "manager",
    label: "Manager",
    permissions: [
      "hotel.view",
      "hotel.create_booking",
      "hotel.checkin",
      "hotel.checkout",
      "hotel.cancel_booking",
      "hotel.discount",
      "hotel.update_room_status",
      "restaurant.view",
      "restaurant.create_order",
      "restaurant.update_order_status",
      "restaurant.cancel_order",
      "restaurant.bill_order",
      "restaurant.manage_menu",
      "ocr.view",
      "ocr.scan",
      "ocr.verify",
      "staff.view",
      "staff.view_all",
      "reports.view",
      "audit.view",
      "alerts.view",
      "alerts.resolve",
      "sync.view",
      "inventory.view",
      "inventory.manage",
      "inventory.adjust_stock",
      "finance.view",
      "finance.log_expense",
      "finance.approve_expense",
      "finance.manage_cash_shift",
      "finance.refund",
      "hotel.manage_maintenance",
    ],
  },
  {
    name: "receptionist",
    label: "Receptionist",
    permissions: [
      "hotel.view",
      "hotel.create_booking",
      "hotel.checkin",
      "hotel.checkout",
      "hotel.cancel_booking",
      "ocr.view",
      "ocr.scan",
      "ocr.verify",
    ],
  },
  {
    name: "waiter",
    label: "Waiter",
    permissions: ["restaurant.view", "restaurant.create_order", "restaurant.update_order_status", "restaurant.bill_order"],
  },
  {
    name: "housekeeper",
    label: "Housekeeper",
    permissions: ["hotel.view_cleaning", "hotel.update_room_status"],
  },
  {
    name: "kitchen_staff",
    label: "Kitchen Staff",
    permissions: ["restaurant.view", "restaurant.update_order_status"],
  },
  {
    name: "cashier",
    label: "Cashier",
    permissions: [
      "restaurant.view",
      "restaurant.create_order",
      "restaurant.bill_order",
      "hotel.checkout",
      "finance.view",
      "finance.log_expense",
      "finance.manage_cash_shift",
    ],
  },
  {
    name: "inventory_manager",
    label: "Inventory Manager",
    permissions: [
      "ocr.view",
      "ocr.scan",
      "ocr.verify",
      "reports.view",
      "inventory.view",
      "inventory.manage",
      "inventory.adjust_stock",
      "finance.view",
      "finance.log_expense",
    ],
  },
];
