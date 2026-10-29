/** Flutter `AppUserProfile.initials` (e.g. Rajesh Kumar → RK). */
export function userInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '');
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const w = parts[0];
    return (w.length >= 2 ? w.substring(0, 2) : w).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
