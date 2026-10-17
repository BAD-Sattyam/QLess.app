export type CustomizationGroup = {
  name: string;
  options: { label: string; price_paise: number }[];
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Confirmed",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  collected: "Collected",
  cancelled: "Cancelled",
};

export function parseGroups(raw: unknown): CustomizationGroup[] {
  return Array.isArray(raw) ? (raw as CustomizationGroup[]) : [];
}

/** Display-only estimate. The server recalculates the real total. */
export function estimateUnitPrice(
  basePaise: number,
  groups: CustomizationGroup[],
  chosen: Record<string, string>,
): number {
  let total = basePaise;
  for (const g of groups) {
    const label = chosen[g.name] ?? g.options[0]?.label;
    const opt = g.options.find((o) => o.label === label);
    total += opt?.price_paise ?? 0;
  }
  return total;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

export function formatTimeIST(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** "07:30:00" -> "7:30 am" */
export function formatClock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(d);
}

export function istDayStart(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00+05:30`);
}
