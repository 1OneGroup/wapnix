import config from '../config.js';

/**
 * Make HTTP requests to the running Wapnix server.
 * Used for operations that need the live Baileys session (sending messages, session management).
 */
export async function apiRequest(method, path, body = null) {
  const url = `${config.serverUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${response.status}`);
  }

  return data;
}
