import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveUserId } from './db.js';
import { registerContactTools } from './tools/contacts.js';
import { registerTemplateTools } from './tools/templates.js';
import { registerMessageTools } from './tools/messages.js';
import { registerChatbotTools } from './tools/chatbot.js';
import { registerCampaignTools } from './tools/campaigns.js';
import { registerDashboardTools } from './tools/dashboard.js';
import { registerWebsiteTools } from './tools/website.js';
import { registerSessionTools } from './tools/session.js';
import { registerAdminTools } from './tools/admin.js';

const server = new McpServer({
  name: 'wapnix',
  version: '1.0.0',
  description: 'Wapnix WhatsApp Business Automation Platform - manage contacts, templates, messages, chatbot flows, campaigns, leads, and WhatsApp sessions',
});

// Resolve user ID once at startup
let userId;
function getUserId() {
  if (!userId) userId = resolveUserId();
  return userId;
}

// Register all tool categories
registerContactTools(server, getUserId);
registerTemplateTools(server, getUserId);
registerMessageTools(server, getUserId);
registerChatbotTools(server, getUserId);
registerCampaignTools(server, getUserId);
registerDashboardTools(server, getUserId);
registerWebsiteTools(server, getUserId);
registerSessionTools(server, getUserId);
registerAdminTools(server, getUserId);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
