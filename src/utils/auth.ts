export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

/**
 * Ensure the persisted `user` object in localStorage contains the expected keys.
 * If `authUser` is provided (from in-memory auth), use it to fill missing values.
 * Returns the normalized user object or null on error.
 */
export const ensureStoredUserShape = (authUser?: any) => {
  try {
    const raw = localStorage.getItem('user');
    let obj: any = raw ? JSON.parse(raw) : {};
    // Keep a copy so we can detect changes
    const updated = { ...obj };

    // Fill common fields from authUser when missing
    if ((!updated.id || updated.id === '') && authUser?.email) updated.id = authUser.email;
    if ((!updated.ps || updated.ps === '') && (authUser?.ps || authUser?.ps === 0)) updated.ps = authUser.ps;
    if ((!updated.Cuser || updated.Cuser === '') && (authUser?.Cuser || authUser?.Cuser === 0)) updated.Cuser = authUser.Cuser ?? authUser.id_user ?? authUser.id;
    if ((!updated.roles || updated.roles.length === 0) && (authUser?.roles || authUser?.role)) updated.roles = authUser.roles ?? authUser.role;
    if ((!updated.name_user || updated.name_user === '') && (authUser?.name_user || authUser?.name)) updated.name_user = authUser.name_user ?? authUser.name;
    if ((!updated.Prvilege || updated.Prvilege.length === 0) && (authUser?.roles || authUser?.Prvilege)) updated.Prvilege = authUser.Prvilege ?? authUser.roles;

    // If updated differs from original, persist
    const changed = JSON.stringify(updated) !== JSON.stringify(obj);
    if (changed) localStorage.setItem('user', JSON.stringify(updated));
    return updated;
  } catch (e) {
    // If parsing failed, remove the broken key to avoid later errors
    try { localStorage.removeItem('user'); } catch {}
    return null;
  }
};