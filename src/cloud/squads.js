// Squads client — thin wrappers around the server endpoints.
// All require sign-in. Caller is responsible for handling errors / showing UI.

import { apiGet, apiPost, apiDelete } from './api.js';

export async function createSquad(name) {
  return apiPost('/squads/create', { name });
}

export async function joinSquad(inviteCode) {
  return apiPost('/squads/join', { inviteCode: String(inviteCode).trim().toUpperCase() });
}

// Public — does NOT require sign-in. Used by the deep-link landing flow
// so we can show squad name + member count in a confirm popup before
// asking the user to sign in / join.
export async function previewSquad(inviteCode) {
  const code = String(inviteCode).trim().toUpperCase();
  return apiGet(`/squads/preview?code=${encodeURIComponent(code)}`, { auth: false });
}

export async function listMySquads() {
  const resp = await apiGet('/squads');
  return resp?.squads || [];
}

// window: 'day' (default) | 'week' | 'all'
export async function getSquadBoard(squadId, date, lang, window = 'day') {
  const params = new URLSearchParams();
  if (date)   params.set('date', date);
  if (lang)   params.set('lang', lang);
  if (window) params.set('window', window);
  const path = `/squads/${encodeURIComponent(squadId)}/board?${params.toString()}`;
  return apiGet(path);
}

// Owner → disbands; member → leaves
export async function leaveOrDisbandSquad(squadId) {
  return apiDelete(`/squads/${encodeURIComponent(squadId)}`);
}
