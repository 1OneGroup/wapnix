import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, MessageSquare, Shield, Clock, Ban } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/register" className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline text-sm mb-6">
          <ArrowLeft size={16} /> Back to Register
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Terms & Conditions</h1>
          <p className="text-sm text-gray-400 mb-6">Last updated: March 2026</p>

          {/* Disclaimer */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
            <h2 className="flex items-center gap-2 text-red-700 font-bold text-lg mb-3">
              <AlertTriangle size={20} /> Disclaimer - Important
            </h2>
            <ul className="space-y-2 text-sm text-red-800">
              <li>WhatsApp may <strong>temporarily or permanently ban</strong> your number if it detects unusual activity like bulk messaging, too many messages in short time, or sending to unknown numbers.</li>
              <li><strong>Wapnix is not responsible</strong> for any ban, restriction, or loss of your WhatsApp account. You use this service at your own risk.</li>
              <li>We do <strong>NOT</strong> guarantee message delivery. Messages may fail, get delayed, or not be delivered at all.</li>
              <li>By using Wapnix, you acknowledge and accept these risks.</li>
            </ul>
          </div>

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
            <h2 className="flex items-center gap-2 text-blue-700 font-bold text-lg mb-3">
              <MessageSquare size={20} /> How Wapnix Works
            </h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h3 className="font-semibold text-blue-800 mb-1">1. Link Your WhatsApp</h3>
                <p>Scan a QR code from the "Device Link" page to connect your WhatsApp number with Wapnix. This works like WhatsApp Web - your phone stays the primary device.</p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 mb-1">2. Create Message Templates</h3>
                <p>Create reusable message templates with variables like {"{{name}}"}, {"{{phone}}"}, {"{{city}}"} etc. These variables get replaced with actual values when sending.</p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 mb-1">3. Upload Contacts (CSV)</h3>
                <p>Upload a CSV file with your contacts. The file should have columns like name, phone, city etc. The phone column is auto-detected.</p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 mb-1">4. Send Messages</h3>
                <p>Write your message (with variables), activate the sheet, and click "Start Sending". Messages are sent one-by-one with a <strong>15 second gap</strong> between each message to reduce ban risk.</p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 mb-1">5. Chatbot Auto-Reply</h3>
                <p>Create chatbot flows with multiple steps and options. When someone messages you, the bot automatically replies based on your flow. You can also set it to only reply to numbers from your uploaded sheet.</p>
              </div>
            </div>
          </div>

          {/* Safety Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6">
            <h2 className="flex items-center gap-2 text-yellow-700 font-bold text-lg mb-3">
              <Shield size={20} /> Tips to Avoid Ban
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2"><Ban size={14} className="text-red-500 mt-0.5 shrink-0" /> <span>Do NOT send messages to numbers who haven't saved your number or don't know you.</span></li>
              <li className="flex items-start gap-2"><Clock size={14} className="text-yellow-600 mt-0.5 shrink-0" /> <span>Keep gaps between messages. We use 15 seconds gap by default - don't reduce it.</span></li>
              <li className="flex items-start gap-2"><Shield size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" /> <span>Start with small batches (10-20 messages) and increase gradually.</span></li>
              <li className="flex items-start gap-2"><Shield size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" /> <span>Avoid sending same message to everyone. Use personalization variables.</span></li>
              <li className="flex items-start gap-2"><Shield size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" /> <span>Don't send more than 200-300 messages per day from a single number.</span></li>
              <li className="flex items-start gap-2"><Shield size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" /> <span>If your number gets a temporary ban (usually 24-48 hours), stop all messaging and wait.</span></li>
            </ul>
          </div>

          {/* Usage Policy */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-lg text-gray-800 mb-3">Usage Policy</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>Do not use Wapnix for spam, fraud, harassment, or any illegal activity.</li>
              <li>Do not send promotional messages without recipient's consent.</li>
              <li>You are solely responsible for the content of your messages.</li>
              <li>Wapnix reserves the right to suspend accounts that violate these terms.</li>
              <li>We do not store or read your WhatsApp messages. All data stays on your linked session.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
