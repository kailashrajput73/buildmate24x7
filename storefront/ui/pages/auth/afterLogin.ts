/** Where to go after login: the page that sent the user to /login (?next=…), else home. */
const KEY = 'bm_after_login';

export function rememberAfterLogin(path: string | null) {
  try {
    if (path && path.startsWith('/') && !path.startsWith('//')) sessionStorage.setItem(KEY, path);
  } catch { /* ignore */ }
}

export function afterLoginPath(): string {
  try {
    const p = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (p) return p;
  } catch { /* ignore */ }
  return '/';
}
