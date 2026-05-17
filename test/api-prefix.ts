/** Matches `API_PREFIX` in src/common/constants/api.constants.ts */
export const API_PREFIX = '/api/v1';

export function api(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_PREFIX}${p}`;
}
