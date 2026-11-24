/** Embedded database relations can be a row, an array of rows, or null. */
export function relationRows<T extends { id: string } = { id: string }>(value: unknown): T[] {
 const rows = Array.isArray(value) ? value : value == null ? [] : [value];
 return rows.filter((row): row is T => !!row && typeof row === 'object' && !Array.isArray(row) && typeof row.id === 'string' && row.id.length > 0);
}

/** Keep the application itself intact while standardizing its embedded relations. */
export function normalizeApplicationRelations<T extends { employment_records?: unknown; application_events?: unknown }>(application: T) {
 return {
   ...application,
   employment_records: relationRows(application.employment_records),
   application_events: relationRows(application.application_events),
 };
}
