// Utility to get user info from localStorage
export function getUserInfo() {
  let role = null;
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      role = userObj.roles ?? localStorage.getItem('roles');
    } catch {
      // Could add error handling here
    }
  } else {
    role = localStorage.getItem('roles');
  }
  return { role };
}

// Check if the role contains a specific value
export function hasRole(param) {
  const { role } = getUserInfo();

  const needle = String(param || '').toLowerCase();
  if (!needle) return false;

  if (typeof role === 'string') return role.toLowerCase().includes(needle);

  // Some accounts store roles as an array (or object). Normalize to a string.
  if (Array.isArray(role)) {
    return role.some((r) => String(r || '').toLowerCase().includes(needle));
  }

  if (role && typeof role === 'object') {
    try {
      return JSON.stringify(role).toLowerCase().includes(needle);
    } catch {
      return false;
    }
  }

  return false;
}
