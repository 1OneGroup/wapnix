import { z } from 'zod';
import { getDb } from '../db.js';
import { apiRequest } from '../lib/http-client.js';

export function registerSessionTools(server, getUserId) {
  server.tool('whatsapp_status', 'Get WhatsApp connection status and queue stats', {}, async () => {
    const db = getDb();
    const userId = getUserId();

    // Get session from DB
    const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(userId);

    // Try to get live status from HTTP API
    let liveStatus = null;
    try {
      liveStatus = await apiRequest('GET', '/api/v1/session/status');
    } catch {
      // Server may not be running
    }

    return { content: [{ type: 'text', text: JSON.stringify({
      db_status: session ? {
        status: session.status,
        whatsapp_number: session.whatsapp_number,
        connected_at: session.connected_at,
        disconnected_at: session.disconnected_at,
      } : { status: 'no_session' },
      live_status: liveStatus?.data || null,
    }, null, 2) }] };
  });

  server.tool('whatsapp_connect', 'Initiate WhatsApp connection (returns pairing code - user must enter it on their phone). Requires Wapnix server running.', {
    mode: z.enum(['qr', 'pairing']).optional().default('pairing').describe('Connection mode: qr or pairing'),
  }, async ({ mode }) => {
    try {
      const result = await apiRequest('POST', '/api/v1/legacy/connect', { mode });
      return { content: [{ type: 'text', text: `WhatsApp connection initiated. ${mode === 'pairing' ? 'The pairing code will appear in the Wapnix UI. The user needs to enter it on WhatsApp > Linked Devices > Link with phone number.' : 'QR code will appear in the Wapnix UI.'}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error connecting WhatsApp: ${err.message}. Make sure the Wapnix server is running.` }], isError: true };
    }
  });

  server.tool('whatsapp_disconnect', 'Disconnect the WhatsApp session. Requires Wapnix server running.', {}, async () => {
    try {
      await apiRequest('POST', '/api/v1/legacy/disconnect');
      return { content: [{ type: 'text', text: 'WhatsApp disconnected.' }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });
}
