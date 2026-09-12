export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const buildApiUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
