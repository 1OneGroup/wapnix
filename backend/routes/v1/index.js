import { Router } from 'express';
import { authenticateApiKey } from '../../middleware/apiKeyAuth.js';
import { responseWrapper } from '../../middleware/responseWrapper.js';

import accountRoutes from './account.js';
import contactRoutes from './contacts.js';
import templateRoutes from './templates.js';
import messageRoutes from './messages.js';
import chatbotRoutes from './chatbot.js';
import campaignRoutes from './campaigns.js';
import leadRoutes from './leads.js';
import analyticsRoutes from './analytics.js';
import webhookRoutes from './webhooks.js';

const router = Router();

// All v1 routes require API key auth + response wrapper
router.use(authenticateApiKey);
router.use(responseWrapper);

router.use('/', accountRoutes);
router.use('/contacts', contactRoutes);
router.use('/templates', templateRoutes);
router.use('/messages', messageRoutes);
// Shortcut: /api/v1/send and /api/v1/send-bulk (alias for /api/v1/messages/send)
router.use('/', messageRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/leads', leadRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
