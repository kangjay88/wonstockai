/**
 * Builds a resume filename like "JayKang_Resume.pdf" from the contact name,
 * with an optional company suffix ("JayKang_Resume_Acme.pdf").
 *
 * Kept free of any @react-pdf/renderer import so it's safe to use in
 * server-rendered code paths.
 */
export function resumeFileName(name: string, companySuffix?: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  const base =
    parts.length >= 2
      ? `${parts[0]}${parts[parts.length - 1]}`
      : parts[0] || "Resume";

  const suffix = companySuffix
    ? `_${companySuffix.replace(/[^A-Za-z0-9]/g, "")}`
    : "";

  return `${base}_Resume${suffix}.pdf`;
}
