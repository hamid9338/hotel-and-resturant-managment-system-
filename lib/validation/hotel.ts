import { z } from "zod";

export const paymentMethodEnum = z.enum(["CASH", "EASYPAISA", "JAZZCASH", "BANK", "CARD"]);

const dateString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  error: "Invalid date.",
});

export const createBookingSchema = z
  .object({
    roomId: z.string().min(1),
    guestName: z.string().min(2, { error: "Guest name is required." }).trim(),
    cnic: z.string().trim().optional(),
    passportNo: z.string().trim().optional(),
    phone: z.string().min(6, { error: "Phone number is required." }).trim(),
    address: z.string().trim().optional(),
    checkIn: dateString,
    checkOut: dateString,
    advancePaid: z.number().min(0).default(0),
    paymentMethod: paymentMethodEnum.default("CASH"),
    notes: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.checkOut) > new Date(data.checkIn), {
    error: "Checkout date must be after check-in date.",
    path: ["checkOut"],
  })
  .refine((data) => Boolean(data.cnic) || Boolean(data.passportNo), {
    error: "Either CNIC or passport number is required.",
    path: ["cnic"],
  });

export const checkoutSchema = z.object({
  paymentMethod: paymentMethodEnum.default("CASH"),
  finalPayment: z.number().min(0).default(0),
});

export const discountSchema = z.object({
  percent: z.number().min(0).max(100),
  reason: z.string().trim().min(3, { error: "A reason is required for discounts." }),
});

export const roomStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"]),
});

export const availabilityQuerySchema = z
  .object({
    roomId: z.string().min(1),
    checkIn: dateString,
    checkOut: dateString,
  })
  .refine((data) => new Date(data.checkOut) > new Date(data.checkIn), {
    error: "Checkout date must be after check-in date.",
    path: ["checkOut"],
  });

export const guestSchema = z.object({
  name: z.string().min(2, { error: "Name is required." }).trim(),
  cnic: z.string().trim().optional(),
  passportNo: z.string().trim().optional(),
  phone: z.string().min(6, { error: "Phone number is required." }).trim(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
