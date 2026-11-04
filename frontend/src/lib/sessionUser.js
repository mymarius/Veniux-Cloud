// Browser storage is untrusted and may be corrupt after an interrupted update.
export function readSessionUser() {
  try {
    const value=JSON.parse(localStorage.getItem('user') || '{}');
    return value && typeof value==='object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
