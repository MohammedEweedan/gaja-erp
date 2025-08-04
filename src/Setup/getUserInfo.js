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
  return typeof role === 'string' && role.includes(param);
}
