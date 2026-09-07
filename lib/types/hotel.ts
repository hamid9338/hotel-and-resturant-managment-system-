export type Guest = {
  id: string;
  name: string;
  phone: string;
  cnic: string | null;
  passportNo?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  createdAt?: string;
};

export type RoomTypeInfo = { id: string; name: string; basePrice: string; capacity: number; amenities: string[] };

export type BookingSummary = {
  id: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: string;
  advancePaid: string;
  balanceDue: string;
  paymentStatus: string;
  status: string;
  guest: Guest;
};

export type RoomWithBookings = {
  id: string;
  number: string;
  floor: number;
  status: string;
  notes: string | null;
  roomType: RoomTypeInfo;
  activeBooking: BookingSummary | null;
  upcomingBookings: BookingSummary[];
};
