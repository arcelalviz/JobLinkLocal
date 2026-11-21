export const OLONGAPO_BARANGAYS = [
  'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'East Tapinac',
  'Gordon Heights', 'Kalaklan', 'New Kalalake', 'Mabayuan', 'New Cabalan',
  'New Ilalim', 'New Kababae', 'Pag-asa', 'Santa Rita',
  'West Bajac-Bajac', 'West Tapinac', 'Old Cabalan'
] as const;

export type OlongapoBarangay = (typeof OLONGAPO_BARANGAYS)[number];

export function isOlongapoBarangay(value: unknown): value is OlongapoBarangay {
  return typeof value === 'string' && OLONGAPO_BARANGAYS.includes(value as OlongapoBarangay);
}

export function olongapoAddress(barangay: string, addressLine = ''): string {
  return [addressLine.trim(), barangay ? `Brgy. ${barangay}` : '', 'Olongapo City'].filter(Boolean).join(', ');
}

export function manilaTimestamp(value?: string | null): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(parsed);
}
