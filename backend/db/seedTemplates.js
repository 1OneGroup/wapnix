import db from './database.js';

const defaultTemplates = [
  { name: 'Welcome Message', body: 'Hi {{name}}, welcome to our service! We\'re glad to have you on board. Feel free to reach out if you need any help.', category: 'greeting' },
  { name: 'Order Confirmation', body: 'Hi {{name}}, your order #{{order_id}} has been confirmed! Total: ₹{{amount}}. Expected delivery: {{date}}. Thank you for shopping with us!', category: 'notification' },
  { name: 'Payment Reminder', body: 'Hi {{name}}, this is a friendly reminder that your payment of ₹{{amount}} is due on {{date}}. Please make the payment at your earliest convenience.', category: 'notification' },
  { name: 'Appointment Reminder', body: 'Hi {{name}}, just a reminder about your appointment on {{date}} at {{time}}. Please confirm your attendance by replying YES.', category: 'notification' },
  { name: 'Thank You', body: 'Hi {{name}}, thank you for your purchase! We appreciate your business and hope you enjoy your {{product}}. See you again soon!', category: 'greeting' },
  { name: 'Shipping Update', body: 'Hi {{name}}, your order #{{order_id}} has been shipped! Tracking ID: {{tracking_id}}. Expected delivery: {{date}}.', category: 'notification' },
  { name: 'Feedback Request', body: 'Hi {{name}}, we hope you enjoyed our service! Could you take a moment to share your feedback? Your opinion matters to us. Rate us: {{link}}', category: 'marketing' },
  { name: 'Discount Offer', body: 'Hi {{name}}, great news! Use code {{code}} to get {{discount}}% off on your next purchase. Valid till {{date}}. Shop now!', category: 'marketing' },
  { name: 'New Product Launch', body: 'Hi {{name}}, exciting news! We just launched {{product}}. Be among the first to check it out. Visit: {{link}}', category: 'marketing' },
  { name: 'Event Invitation', body: 'Hi {{name}}, you\'re invited to {{event}} on {{date}} at {{venue}}. RSVP by replying YES. We\'d love to see you there!', category: 'marketing' },
  { name: 'Birthday Wish', body: 'Happy Birthday {{name}}! 🎂 Wishing you a wonderful year ahead. Here\'s a special {{discount}}% discount as our gift! Use code: {{code}}', category: 'greeting' },
  { name: 'Subscription Renewal', body: 'Hi {{name}}, your {{plan}} subscription expires on {{date}}. Renew now to continue enjoying uninterrupted service. Renew: {{link}}', category: 'notification' },
  { name: 'OTP Verification', body: 'Your verification code is {{otp}}. Valid for {{minutes}} minutes. Do not share this code with anyone.', category: 'notification' },
  { name: 'Account Activation', body: 'Hi {{name}}, your account has been activated successfully! You can now login and start using our services. Login: {{link}}', category: 'notification' },
  { name: 'Service Downtime', body: 'Hi {{name}}, we will be performing scheduled maintenance on {{date}} from {{start_time}} to {{end_time}}. Services may be temporarily unavailable.', category: 'notification' },
  { name: 'Follow-up Message', body: 'Hi {{name}}, hope you\'re doing well! Just checking in regarding {{topic}}. Would love to hear back from you. Let me know a good time to connect.', category: 'general' },
  { name: 'Invoice Sent', body: 'Hi {{name}}, invoice #{{invoice_id}} for ₹{{amount}} has been generated. Due date: {{date}}. Download: {{link}}', category: 'notification' },
  { name: 'Delivery Completed', body: 'Hi {{name}}, your order #{{order_id}} has been delivered successfully! If you have any issues, please contact our support team.', category: 'notification' },
  { name: 'Referral Program', body: 'Hi {{name}}, share the love! Refer a friend and both of you get ₹{{reward}}. Your referral code: {{code}}. Share now!', category: 'marketing' },
  { name: 'Holiday Greeting', body: 'Hi {{name}}, wishing you a very Happy {{festival}}! May this season bring you joy and prosperity. Warm regards from our team!', category: 'greeting' },
];

function extractVars(body) {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

// Seed templates for all existing users
const users = db.prepare('SELECT id FROM users').all();

const insert = db.prepare(
  'INSERT OR IGNORE INTO templates (user_id, name, body, variables, category) VALUES (?, ?, ?, ?, ?)'
);

const txn = db.transaction(() => {
  for (const user of users) {
    let added = 0;
    for (const tpl of defaultTemplates) {
      const vars = JSON.stringify(extractVars(tpl.body));
      const result = insert.run(user.id, tpl.name, tpl.body, vars, tpl.category);
      if (result.changes > 0) added++;
    }
    console.log(`User ${user.id}: added ${added} templates`);
  }
});

txn();
console.log('Done! Seeded 20 default templates.');
