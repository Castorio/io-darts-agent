/**
 * Value of an <input type="number">: an empty (or unparsable) field is null,
 * not 0, so a cleared field means "not set" (e.g. WLED fadeTime: WLED default).
 */
export function parseNumberInput(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
