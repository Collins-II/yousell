export const normalizeRegionName = (value: string) =>
  value.trim().replace(/\s+/g, " ").replace(/ (province|state|county)$/i, "");

export function regionNamePattern(value: string) {
  const escaped = normalizeRegionName(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped.replace(/ /g, "\\s+")}(?:\\s+(?:province|state|county))?\\s*$`, "i");
}
