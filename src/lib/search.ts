export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Every word of the query must appear somewhere in the fields; accents and case are ignored. */
export function matches(query: string, fields: (string | null | undefined)[]): boolean {
  const haystack = normalize(fields.filter(Boolean).join(" "));

  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Matching items, those whose first field starts with the query first. */
export function search<T>(query: string, items: T[], fields: (item: T) => (string | null | undefined)[], limit: number): T[] {
  const start = normalize(query.trim());

  return items
    .filter((item) => matches(query, fields(item)))
    .sort((a, b) => Number(normalize(fields(b)[0] ?? "").startsWith(start)) - Number(normalize(fields(a)[0] ?? "").startsWith(start)))
    .slice(0, limit);
}
