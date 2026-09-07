export function formatCurrency(amount: number, currency = "PKR"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(
    "en-US",
    opts ?? { day: "2-digit", month: "short", year: "numeric" }
  );
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInputValue(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}
