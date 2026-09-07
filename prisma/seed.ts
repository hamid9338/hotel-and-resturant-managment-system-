/**
 * Demo/seed data for Kashmir View Lodges HMS. Safe to re-run — each section
 * checks whether it has already been seeded before inserting.
 *
 * Run with: npx prisma db seed
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PERMISSIONS, ROLES } from "../lib/rbac-matrix";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const STAFF = [
  { name: "Ahmed Owner", username: "owner", pin: "9999", role: "owner", shift: "Remote" },
  { name: "Faisal Khan", username: "manager", pin: "4444", role: "manager", shift: "Morning" },
  { name: "Muhammad Kamran", username: "kamran", pin: "1234", role: "receptionist", shift: "Morning" },
  { name: "Tariq Ahmed", username: "tariq", pin: "3333", role: "waiter", shift: "Morning" },
  { name: "Ayesha Bibi", username: "ayesha", pin: "2222", role: "housekeeper", shift: "Morning" },
  { name: "Zainab Naz", username: "zainab", pin: "5555", role: "waiter", shift: "Evening" },
  { name: "Bilal Rasheed", username: "bilal", pin: "6666", role: "kitchen_staff", shift: "Morning" },
  { name: "Sana Malik", username: "sana", pin: "7777", role: "cashier", shift: "Evening" },
  { name: "Imran Sheikh", username: "imran", pin: "8888", role: "inventory_manager", shift: "Morning" },
];

const ROOM_TYPES = [
  { name: "Standard", basePrice: 2500, capacity: 2, amenities: ["WiFi", "AC", "TV"] },
  { name: "Deluxe", basePrice: 4000, capacity: 2, amenities: ["WiFi", "AC", "TV", "Mini Fridge"] },
  { name: "Suite", basePrice: 7000, capacity: 3, amenities: ["WiFi", "AC", "TV", "Mini Fridge", "Jacuzzi"] },
  { name: "Family", basePrice: 5500, capacity: 5, amenities: ["WiFi", "AC", "TV", "Extra Beds"] },
];

// 24 rooms, 6 per type, spread across floors 1-4.
const ROOMS: { number: string; floor: number; type: string }[] = [];
ROOM_TYPES.forEach((type, typeIndex) => {
  const floor = typeIndex + 1;
  for (let i = 1; i <= 6; i++) {
    ROOMS.push({ number: `${floor}${String(i).padStart(2, "0")}`, floor, type: type.name });
  }
});

const GUESTS = [
  { name: "Ahmed Raza", cnic: "42101-1234567-1", phone: "0300-1112233", address: "Lahore" },
  { name: "Usman Ali", cnic: "35201-1234000-3", phone: "0333-7778899", address: "Karachi" },
  { name: "Fatima Noor", cnic: "42301-5551234-4", phone: "0345-6667788", address: "Islamabad" },
  { name: "Sara Khan", cnic: "42201-9876543-2", phone: "0321-4445566", address: "Lahore" },
  { name: "Bilal Maqsood", cnic: "35101-2223333-5", phone: "0311-0009988", address: "Rawalpindi" },
  { name: "Dr. Zara Chaudhry", cnic: "42501-8889999-6", phone: "0300-5554433", address: "Peshawar" },
  { name: "Hassan Family", cnic: "35202-3334444-7", phone: "0312-6665544", address: "Multan" },
  { name: "Nadia Yousuf", cnic: "42101-7778888-9", phone: "0333-2221100", address: "Lahore" },
];

const MENU: { name: string; category: string; price: number; available?: boolean; description: string }[] = [
  { name: "Paratha with Egg", category: "Breakfast", price: 120, description: "Classic desi breakfast" },
  { name: "Halwa Puri", category: "Breakfast", price: 180, description: "Traditional halwa puri set" },
  { name: "Nihari", category: "Breakfast", price: 350, description: "Slow-cooked beef nihari" },
  { name: "Aloo Keema Paratha", category: "Breakfast", price: 160, description: "Spiced potato and mince" },
  { name: "Chana Chaat", category: "Breakfast", price: 140, description: "Spiced chickpea salad" },
  { name: "Chicken Karahi", category: "Main", price: 850, description: "Classic chicken karahi" },
  { name: "Mutton Karahi", category: "Main", price: 1400, description: "Premium mutton karahi" },
  { name: "Beef Handi", category: "Main", price: 950, description: "Slow-cooked beef handi" },
  { name: "Daal Makhani", category: "Main", price: 350, description: "Creamy black lentils" },
  { name: "Palak Gosht", category: "Main", price: 900, description: "Spinach and meat curry" },
  { name: "Mix Vegetable", category: "Main", price: 300, available: false, description: "Seasonal vegetables" },
  { name: "Chicken Tikka", category: "Main", price: 600, description: "Charcoal-grilled chicken tikka" },
  { name: "Seekh Kebab", category: "Main", price: 550, description: "Minced beef seekh kebab, 4 pcs" },
  { name: "Naan", category: "Breads", price: 30, description: "Soft tandoor naan" },
  { name: "Tandoori Roti", category: "Breads", price: 25, description: "Whole wheat roti" },
  { name: "Lachha Paratha", category: "Breads", price: 60, description: "Layered flaky paratha" },
  { name: "Peshwari Naan", category: "Breads", price: 80, description: "Sweet stuffed naan" },
  { name: "Garlic Naan", category: "Breads", price: 70, description: "Naan with garlic and butter" },
  { name: "Plain Rice", category: "Rice", price: 150, description: "Steamed basmati" },
  { name: "Chicken Biryani", category: "Rice", price: 450, description: "Aromatic chicken biryani" },
  { name: "Mutton Pulao", category: "Rice", price: 600, description: "Tender mutton pulao" },
  { name: "Zeera Rice", category: "Rice", price: 200, description: "Cumin flavoured rice" },
  { name: "Vegetable Biryani", category: "Rice", price: 350, description: "Aromatic vegetable biryani" },
  { name: "Lassi Sweet", category: "Drinks", price: 120, description: "Chilled sweet lassi" },
  { name: "Soft Drink", category: "Drinks", price: 80, description: "Pepsi / 7Up / Mirinda" },
  { name: "Kahwa", category: "Drinks", price: 100, description: "Green tea with spices" },
  { name: "Water Bottle", category: "Drinks", price: 60, description: "500ml mineral water" },
  { name: "Fresh Lime Soda", category: "Drinks", price: 110, description: "Sparkling lime soda" },
  { name: "Mint Margarita (Mocktail)", category: "Drinks", price: 180, description: "Non-alcoholic mint margarita" },
  { name: "Kheer", category: "Desserts", price: 150, description: "Rice pudding" },
  { name: "Gulab Jamun", category: "Desserts", price: 120, description: "2 pieces with syrup" },
  { name: "Firni", category: "Desserts", price: 130, description: "Chilled ground rice pudding" },
  { name: "Kulfi Falooda", category: "Desserts", price: 220, description: "Traditional kulfi with falooda" },
];

async function seedPermissionsAndRoles() {
  const permissionByKey = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: p,
    });
    permissionByKey.set(p.key, row.id);
  }

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { label: r.label },
      create: { name: r.name, label: r.label },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: r.permissions.map((key) => ({ roleId: role.id, permissionId: permissionByKey.get(key)! })),
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions across ${ROLES.length} roles.`);
}

async function seedStaff() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Staff already seeded, skipping.");
    return;
  }
  for (const s of STAFF) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: s.role } });
    const pinHash = await bcrypt.hash(s.pin, 10);
    await prisma.user.create({
      data: { name: s.name, username: s.username, pinHash, roleId: role.id, shift: s.shift },
    });
  }
  console.log(`Seeded ${STAFF.length} staff accounts.`);
}

async function seedRoomsAndBookings() {
  const existingRooms = await prisma.room.count();
  if (existingRooms > 0) {
    console.log("Rooms already seeded, skipping rooms/guests/bookings.");
    return;
  }

  const typeIdByName = new Map<string, string>();
  for (const t of ROOM_TYPES) {
    const row = await prisma.roomType.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, basePrice: t.basePrice, capacity: t.capacity, amenities: t.amenities },
    });
    typeIdByName.set(t.name, row.id);
  }

  const roomByNumber = new Map<string, string>();
  for (const r of ROOMS) {
    const row = await prisma.room.create({
      data: { number: r.number, floor: r.floor, roomTypeId: typeIdByName.get(r.type)! },
    });
    roomByNumber.set(r.number, row.id);
  }

  const guestIds: string[] = [];
  for (const g of GUESTS) {
    const row = await prisma.guest.create({ data: g });
    guestIds.push(row.id);
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { username: "owner" } });
  const today = new Date();
  const days = (n: number) => new Date(today.getTime() + n * 86_400_000);

  type DemoBooking = {
    room: string;
    guest: number;
    checkIn: Date;
    checkOut: Date;
    status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT";
    advancePct: number;
  };
  const demoBookings: DemoBooking[] = [
    { room: "201", guest: 0, checkIn: days(-2), checkOut: days(3), status: "CHECKED_IN", advancePct: 0.4 },
    { room: "203", guest: 1, checkIn: days(-1), checkOut: days(4), status: "CHECKED_IN", advancePct: 0.4 },
    { room: "301", guest: 5, checkIn: days(-3), checkOut: days(3), status: "CHECKED_IN", advancePct: 0.3 },
    { room: "401", guest: 6, checkIn: days(-2), checkOut: days(3), status: "CHECKED_IN", advancePct: 0.3 },
    { room: "101", guest: 3, checkIn: days(-9), checkOut: days(-2), status: "CHECKED_OUT", advancePct: 1 },
    { room: "204", guest: 4, checkIn: days(-8), checkOut: days(-1), status: "CHECKED_OUT", advancePct: 1 },
    { room: "302", guest: 2, checkIn: days(2), checkOut: days(6), status: "RESERVED", advancePct: 0.2 },
    { room: "402", guest: 7, checkIn: days(4), checkOut: days(8), status: "RESERVED", advancePct: 0 },
  ];

  for (const b of demoBookings) {
    const roomId = roomByNumber.get(b.room)!;
    const roomType = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { roomType: true } });
    const nights = Math.max(1, Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000));
    const rate = Number(roomType.roomType.basePrice);
    const subtotal = rate * nights;
    const taxAmount = Math.round(subtotal * 0.05);
    const total = subtotal + taxAmount;
    const advancePaid = Math.round(total * b.advancePct);
    const balanceDue = Math.max(0, total - advancePaid);
    const paymentStatus = balanceDue <= 0 ? "PAID" : advancePaid > 0 ? "PARTIAL" : "PENDING";

    await prisma.booking.create({
      data: {
        roomId,
        guestId: guestIds[b.guest],
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        nights,
        rate,
        subtotal,
        taxAmount,
        total,
        advancePaid,
        balanceDue,
        paymentStatus,
        status: b.status,
        createdById: owner.id,
        checkedInAt: b.status !== "RESERVED" ? b.checkIn : null,
        checkedOutAt: b.status === "CHECKED_OUT" ? b.checkOut : null,
        checkedOutById: b.status === "CHECKED_OUT" ? owner.id : null,
      },
    });

    if (b.status === "CHECKED_IN") {
      await prisma.room.update({ where: { id: roomId }, data: { status: "OCCUPIED" } });
    }
  }

  // A couple of rooms awaiting housekeeping, one under maintenance — for the housekeeping/room-grid demo.
  const cleaningRoom = roomByNumber.get("103");
  const maintenanceRoom = roomByNumber.get("304");
  if (cleaningRoom) await prisma.room.update({ where: { id: cleaningRoom }, data: { status: "CLEANING" } });
  if (maintenanceRoom) await prisma.room.update({ where: { id: maintenanceRoom }, data: { status: "MAINTENANCE" } });

  console.log(`Seeded ${ROOMS.length} rooms, ${GUESTS.length} guests, ${demoBookings.length} bookings.`);
}

async function seedMenuAndTables() {
  const existing = await prisma.menuItem.count();
  if (existing === 0) {
    const categoryNames = [...new Set(MENU.map((m) => m.category))];
    const categoryIdByName = new Map<string, string>();
    for (const [index, name] of categoryNames.entries()) {
      const row = await prisma.menuCategory.create({ data: { name, sortOrder: index } });
      categoryIdByName.set(name, row.id);
    }
    for (const item of MENU) {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          categoryId: categoryIdByName.get(item.category)!,
          price: item.price,
          available: item.available ?? true,
          description: item.description,
        },
      });
    }
    console.log(`Seeded ${MENU.length} menu items across ${categoryNames.length} categories.`);
  } else {
    console.log("Menu already seeded, skipping.");
  }

  const existingTables = await prisma.restaurantTable.count();
  if (existingTables === 0) {
    await prisma.restaurantTable.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({ label: `T${i + 1}`, capacity: 4 })),
    });
    console.log("Seeded 6 dine-in tables.");
  }
}

async function seedAuditAndAlerts() {
  const existing = await prisma.auditLog.count();
  if (existing > 0) {
    console.log("Audit log already seeded, skipping.");
    return;
  }
  const kamran = await prisma.user.findUnique({ where: { username: "kamran" } });
  const ayesha = await prisma.user.findUnique({ where: { username: "ayesha" } });
  const tariq = await prisma.user.findUnique({ where: { username: "tariq" } });
  if (!kamran || !ayesha || !tariq) return;

  await prisma.auditLog.createMany({
    data: [
      {
        userId: kamran.id,
        userName: kamran.name,
        userRole: "receptionist",
        action: "Login successful",
        module: "System",
        riskLevel: "NONE",
      },
      {
        userId: ayesha.id,
        userName: ayesha.name,
        userRole: "housekeeper",
        action: "Room 304 marked for maintenance",
        module: "Hotel",
        riskLevel: "NONE",
      },
      {
        userId: tariq.id,
        userName: tariq.name,
        userRole: "waiter",
        action: "Order placed: T3 — Rs. 1,850",
        module: "Restaurant",
        riskLevel: "NONE",
        details: "Chicken Karahi x2",
      },
      {
        userId: kamran.id,
        userName: kamran.name,
        userRole: "receptionist",
        action: "BLOCKED: attempted discount on hotel",
        module: "hotel",
        riskLevel: "HIGH",
        details: "Unauthorized access attempt by receptionist",
      },
    ],
  });

  await prisma.alert.create({
    data: {
      type: "unauthorized",
      message: "Unauthorized action blocked",
      detail: `${kamran.name} (receptionist) attempted to apply a discount without permission`,
      severity: "HIGH",
      userId: kamran.id,
    },
  });

  console.log("Seeded sample audit log entries and one alert.");
}

async function main() {
  await seedPermissionsAndRoles();
  await seedStaff();
  await seedRoomsAndBookings();
  await seedMenuAndTables();
  await seedAuditAndAlerts();
  await prisma.systemSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
