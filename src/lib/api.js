import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export async function authMe() {
  const r = await api.get('/auth/me');
  return r.data;
}

export async function authGoogle(session_id) {
  const r = await api.post('/auth/google', { session_id });
  return r.data;
}

export async function authLogout() {
  await api.post('/auth/logout');
}

export async function processManus(payload) {
  const r = await api.post('/manus/process', payload);
  return r.data;
}

export async function fetchMessages() {
  const r = await api.get('/chat/messages');
  return r.data;
}

export async function fetchEvolutionState() {
  const r = await api.get('/evolution/state');
  return r.data;
}

export async function fetchEvolutionHistory() {
  const r = await api.get('/evolution/history');
  return r.data;
}

export async function fetchEvolutionInsights() {
  const r = await api.get('/evolution/insights');
  return r.data;
}

export async function fetchSandboxFiles() {
  const r = await api.get('/sandbox/files');
  return r.data;
}

export async function uploadSandboxFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await api.post('/sandbox/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return r.data;
}

export async function deleteSandboxFile(name) {
  await api.delete(`/sandbox/files/${encodeURIComponent(name)}`);
}

export async function sendSnapshot(image_b64) {
  const r = await api.post('/manus/snapshot', { image_b64 });
  return r.data;
}
