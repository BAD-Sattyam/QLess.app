export function canAccessStaff(access: { isAdmin: boolean; cafeIds: string[] }, adminOnly = false) {
  return access.isAdmin || (!adminOnly && access.cafeIds.length > 0);
}