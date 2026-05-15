// Squads client — thin wrappers around the server endpoints.
// All require sign-in. Caller is responsible for handling errors / showing UI.

import { apiGet, apiPost, apiDelete } from './api.js';

export async function createSquad(name) {
  return apiPost('/squads/create', { name });
}

export async function joinSquad(inviteCode) {
  return apiPost('/squads/join', { inviteCode: String(inviteCode).trim().toUpperCase() });
}

export async function listMySquads() {
  const resp = await apiGet('/squads');
  return resp?.squads || [];
}

export async function getSquadBoard(squadId, date, lang) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (lang) params.set('lang', lang);
  const path = `/squads/${encodeURIComponent(squadId)}/board?${params.toString()}`;
  return apiGet(path);
}

// Owner → disbands; member → leaves
export async function leaveOrDisbandSquad(squadId) {
  return apiDelete(`/squads/${encodeURIComponent(squadId)}`);
}
