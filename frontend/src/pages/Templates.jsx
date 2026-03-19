import { useState, useEffect } from 'react';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import { Plus, Trash2, Edit2, X, Eye, Copy, Check, Library, ImagePlus, GripVertical, Search, FileText, LayoutGrid, List, Clock, Hash, Sparkles, Send } from 'lucide-react';

// ── Message Template Library — pre-built templates by industry ──
const templateLibrary = [
  {
    category: 'E-Commerce',
    icon: '🛒',
    templates: [
      { name: 'Order Placed', body: "Hi {{name}}, your order *#{{order_id}}* has been placed successfully! 🎉\n\nItems: {{items}}\nTotal: ₹{{amount}}\nPayment: {{payment_mode}}\n\nExpected delivery: {{date}}\nTrack: {{tracking_link}}", category: 'notification' },
      { name: 'Order Shipped', body: "Hi {{name}}, great news! 🚚 Your order *#{{order_id}}* has been shipped!\n\n📦 Courier: {{courier_name}}\n🔢 Tracking: {{tracking_id}}\n📅 Expected: {{date}}\n\nTrack here: {{tracking_link}}", category: 'notification' },
      { name: 'Cart Abandonment', body: "Hi {{name}}, you left something in your cart! 🛒\n\n{{items}} is waiting for you.\n\n🎁 Complete now & get *{{discount}}% OFF*!\nCode: *{{code}}*\n\nShop: {{link}}\n⏰ Expires in 24 hours!", category: 'marketing' },
      { name: 'Flash Sale Alert', body: "🔥 *FLASH SALE* is LIVE! 🔥\n\nHi {{name}}, up to *{{discount}}% OFF* on {{category}}!\n\n⏰ Ends: {{end_time}}\n🛍️ Shop: {{link}}\nCode: *{{code}}*\n\nHurry, limited stock! 🏃‍♂️", category: 'marketing' },
      { name: 'Refund Processed', body: "Hi {{name}}, refund for order *#{{order_id}}* processed! ✅\n\n💰 Amount: ₹{{amount}}\n🏦 To: {{refund_method}}\n📅 By: {{date}}\n\nThank you for your patience! 🙏", category: 'notification' },
      { name: 'Wishlist Price Drop', body: "Hi {{name}}, price drop! 📉\n\n*{{product}}* is now ₹{{new_price}} (was ₹{{old_price}})!\nThat's *{{discount}}% OFF*! 🎉\n\nGrab it: {{link}}", category: 'marketing' },
      { name: 'COD Confirmation', body: "Hi {{name}}, COD order *#{{order_id}}* confirmed! 💵\n\nPay: ₹{{amount}}\nDelivery: {{date}}\n\n⚠️ Keep exact change ready.\nPrepay for ₹{{cashback}} cashback: {{payment_link}}", category: 'notification' },
    ],
  },
  {
    category: 'Restaurant & Food',
    icon: '🍽️',
    templates: [
      { name: 'Food Order Confirmed', body: "Hi {{name}}, your order is confirmed! 🍔\n\n📋 {{items}}\n💰 Total: ₹{{amount}}\n⏰ Ready in: {{time}} mins\n📍 Delivery: {{address}}\n\nTrack: {{link}}", category: 'notification' },
      { name: 'Table Reserved', body: "Hi {{name}}, table reserved! 🪑\n\n📅 {{date}} at {{time}}\n👥 {{guests}} guests\n📍 {{restaurant_name}}\n\n⚠️ Arrive 10 mins early.\nCancel? Reply CANCEL.\n\nSee you! 🍽️", category: 'notification' },
      { name: 'New Menu Launch', body: "Hi {{name}}, our new *{{season}} Menu* is here! 🍽️\n\n🌟 Specials:\n{{menu_highlights}}\n\n📢 First 50 orders get *{{discount}}% OFF*!\nOrder: {{link}}", category: 'marketing' },
      { name: 'Food Feedback', body: "Hi {{name}}, how was your meal? 🍽️\n\nRate us:\n1 - Loved it! 😍\n2 - Good 👍\n3 - Okay 😐\n4 - Not great 👎\n\nReply with a number! 🙏", category: 'general' },
      { name: 'Loyalty Points Earned', body: "Hi {{name}}, you earned *{{points}} loyalty points*! 🎁\n\nBalance: {{total_points}} points\nRedeem {{redeem_points}} pts for ₹{{discount_amount}} off!\n\nOrder: {{link}}", category: 'marketing' },
    ],
  },
  {
    category: 'Healthcare',
    icon: '🏥',
    templates: [
      { name: 'Doctor Appointment', body: "Hi {{name}}, appointment confirmed! ✅\n\n👨‍⚕️ Dr. {{doctor_name}}\n🏥 {{department}}\n📅 {{date}} at {{time}}\n📍 {{clinic_address}}\n\n⚠️ Carry ID & past reports.\nReschedule? Reply RESCHEDULE.", category: 'notification' },
      { name: 'Lab Report Ready', body: "Hi {{name}}, your lab report is ready! 📋\n\n🔬 Test: {{test_name}}\n📅 {{date}}\n\n📥 Download: {{report_link}}\n📞 Consult: {{phone}}\n\nStay healthy! 💚", category: 'notification' },
      { name: 'Medicine Reminder', body: "Hi {{name}}, medicine time! 💊\n\n💊 {{medicine_name}}\n📋 Dosage: {{dosage}}\n⏰ {{time}}\n\nDon't skip! Your health matters. 🙏", category: 'notification' },
      { name: 'Health Checkup Offer', body: "Hi {{name}}, annual checkup time! 🏥\n\n🎁 *{{package_name}}*\n💰 ₹{{amount}} (was ₹{{original_price}})\n\nIncludes: {{tests}}\n\n📞 Book: {{phone}}\n🔗 Online: {{link}}", category: 'marketing' },
      { name: 'Prescription Expiry', body: "Hi {{name}}, prescription from Dr. {{doctor_name}} expires on {{date}}.\n\nSchedule a follow-up for renewal.\n📞 {{phone}}\n🔗 Book: {{link}}\n\nTake care! 🙏", category: 'notification' },
    ],
  },
  {
    category: 'Education',
    icon: '🎓',
    templates: [
      { name: 'Course Enrollment', body: "Hi {{name}}, welcome to *{{course_name}}*! 🎉\n\n📅 Starts: {{start_date}}\n⏰ {{timing}}\n👨‍🏫 Instructor: {{instructor}}\n\n📱 Group: {{group_link}}\n📚 Material: {{material_link}}\n\nAll the best! 🚀", category: 'notification' },
      { name: 'Class Reminder', body: "Hi {{name}}, class reminder! 📚\n\n📖 {{subject}} with {{teacher}}\n📅 {{date}} at {{time}}\n🔗 Join: {{link}}\n📝 Topic: {{topic}}\n\nDon't miss it! 🎯", category: 'notification' },
      { name: 'Exam Schedule', body: "Hi {{name}}, exam alert! 📝\n\n📖 {{subject}}\n📅 {{date}} at {{time}}\n📍 {{venue}}\n\n⚠️ Carry ID & admit card.\n📋 Syllabus: {{syllabus_link}}\n\nBest of luck! 🍀", category: 'notification' },
      { name: 'Result Published', body: "Hi {{name}}, results are out! 📊\n\n📖 {{course_name}}\n📝 Score: {{score}}/{{total}}\n🏆 Grade: {{grade}}\n\n📥 Marksheet: {{link}}\n\nCongratulations! 🎉", category: 'notification' },
      { name: 'New Batch Starting', body: "Hi {{name}}, new batch! 🎓\n\n📚 *{{course_name}}*\n📅 Starts: {{start_date}}\n💰 ₹{{fee}} (Early bird: ₹{{early_fee}})\n\n🎁 *{{discount}}% OFF* for first {{seats}} seats!\n\nEnroll: {{link}}", category: 'marketing' },
      { name: 'Fee Reminder', body: "Hi {{name}}, fee reminder! 💰\n\n📚 {{course_name}}\n💳 Due: ₹{{amount}}\n📅 By: {{date}}\n\nPay: {{payment_link}}\n⚠️ Late fee: ₹{{late_fee}} after due date.\n\n📞 {{phone}}", category: 'notification' },
    ],
  },
  {
    category: 'Real Estate',
    icon: '🏠',
    templates: [
      { name: 'New Property Alert', body: "Hi {{name}}, new property match! 🏠\n\n🏗️ *{{project_name}}*\n📍 {{location}}\n🛏️ {{config}}\n💰 ₹{{price}}\n📐 {{area}} sq.ft\n\n🖼️ Gallery: {{gallery_link}}\n📞 Visit: {{phone}}", category: 'marketing' },
      { name: 'Site Visit Confirmed', body: "Hi {{name}}, visit confirmed! 🏗️\n\n🏠 {{project_name}}\n📅 {{date}} at {{time}}\n📍 {{location}}\n\n👨‍💼 {{executive_name}}: {{phone}}\n🗺️ Directions: {{maps_link}}", category: 'notification' },
      { name: 'EMI Breakdown', body: "Hi {{name}}, EMI details for *{{project_name}}*! 💰\n\n🏠 Value: ₹{{price}}\n💳 Down: ₹{{down_payment}}\n🏦 Loan: ₹{{loan_amount}}\n📅 {{tenure}} years\n💵 EMI: ₹{{emi}}/month\n\n📞 Advisor: {{phone}}", category: 'notification' },
      { name: 'Construction Update', body: "Hi {{name}}, *{{project_name}}* update! 🏗️\n\n📊 Progress: {{progress}}%\n📅 Possession: {{possession_date}}\n\n📸 Photos: {{gallery_link}}\n\nYour dream home is taking shape! 🏠✨", category: 'notification' },
      { name: 'Visit Thank You', body: "Hi {{name}}, thanks for visiting *{{project_name}}*! 🙏\n\n📋 Brochure: {{brochure_link}}\n💰 Prices: {{price_link}}\n🏦 Loans: {{loan_link}}\n\nQuestions? I'm here! 😊\n— {{agent_name}}", category: 'greeting' },
    ],
  },
  {
    category: 'Fitness & Gym',
    icon: '💪',
    templates: [
      { name: 'Gym Welcome', body: "Welcome to *{{gym_name}}*! 💪🎉\n\nHi {{name}},\n📋 Plan: {{plan_name}}\n📅 {{start_date}} to {{end_date}}\n🆔 ID: {{member_id}}\n⏰ Hours: {{timing}}\n\nLet's crush those goals! 🔥", category: 'greeting' },
      { name: 'Workout Reminder', body: "Hey {{name}}, don't skip today! 🏋️\n\n💪 {{workout_type}}\n⏰ {{time}}\n🔥 {{streak}} days streak!\n\n💡 {{fitness_tip}}\n\nSee you! 🙌", category: 'notification' },
      { name: 'Membership Expiry', body: "Hi {{name}}, membership expires {{date}}! ⚠️\n\n🔄 Renew now:\n• {{discount}}% off\n• Free {{bonus}} sessions\n• Priority booking\n\n💰 ₹{{amount}}\nRenew: {{link}}", category: 'notification' },
      { name: 'Diet Plan', body: "Hi {{name}}, weekly diet plan! 🥗\n\n🎯 Goal: {{goal}}\n🔥 {{calories}} kcal/day\n\n🍳 Breakfast: {{breakfast}}\n🥗 Lunch: {{lunch}}\n🍲 Dinner: {{dinner}}\n🥤 Snacks: {{snacks}}\n\n💧 3-4L water daily!", category: 'notification' },
    ],
  },
  {
    category: 'Salon & Beauty',
    icon: '💇',
    templates: [
      { name: 'Salon Booking', body: "Hi {{name}}, appointment booked! ✂️\n\n💇 {{service}}\n📅 {{date}} at {{time}}\n👨‍🎨 Stylist: {{stylist}}\n📍 {{salon_name}}\n\nReschedule? Reply CHANGE.\nSee you! ✨", category: 'notification' },
      { name: 'Salon Offer', body: "Hi {{name}}, pamper time! 💆‍♀️\n\n✨ *{{offer_name}}*\n💇 {{services}}\n💰 ₹{{price}} (Save ₹{{savings}}!)\n📅 Till: {{date}}\n\nBook: {{link}}\n📞 {{phone}}", category: 'marketing' },
      { name: 'Salon Reminder', body: "Hi {{name}}, reminder! 🔔\n\nSalon appointment tomorrow:\n✂️ {{service}}\n📅 {{date}} at {{time}}\n📍 {{salon_name}}\n\nReschedule? Reply CHANGE. ✨", category: 'notification' },
    ],
  },
  {
    category: 'Business & Services',
    icon: '💼',
    templates: [
      { name: 'Quotation Sent', body: "Hi {{name}}, your quotation! 📄\n\n📋 Ref: {{quote_id}}\n🔧 {{service}}\n💰 ₹{{amount}}\n📅 Valid till: {{date}}\n\n📥 Download: {{link}}\n\nReply YES to confirm!\n— {{company}}", category: 'notification' },
      { name: 'Service Completed', body: "Hi {{name}}, service complete! ✅\n\n🔧 {{service}}\n📅 {{date}}\n💰 Invoice: ₹{{amount}}\n\n📄 Invoice: {{invoice_link}}\n⭐ Rate us: {{review_link}}\n\nThank you! 🙏", category: 'notification' },
      { name: 'Meeting Scheduled', body: "Hi {{name}}, meeting confirmed! 📅\n\n📋 {{topic}}\n📅 {{date}} at {{time}}\n📍 {{location}}\n👤 With: {{person}}\n🔗 Join: {{meeting_link}}\n\nSee you! 🤝", category: 'notification' },
      { name: 'Invoice Reminder', body: "Hi {{name}}, payment reminder! 💰\n\n📄 Invoice: {{invoice_id}}\n💳 ₹{{amount}}\n📅 Due: {{date}}\n\nPay: {{payment_link}}\n\nAlready paid? Ignore this.\nThank you! 🙏", category: 'notification' },
    ],
  },
  {
    category: 'Events',
    icon: '🎉',
    templates: [
      { name: 'Event Invite', body: "You're Invited! 🎉\n\nHi {{name}},\n\n✨ *{{event_name}}*\n📅 {{date}} at {{time}}\n📍 {{venue}}\n🎨 Dress: {{dress_code}}\n\n🗺️ Directions: {{maps_link}}\n\nRSVP: Reply YES/NO 🙏", category: 'marketing' },
      { name: 'Event Reminder', body: "Hi {{name}}, reminder! 🔔\n\n*{{event_name}}* is tomorrow!\n📅 {{date}} at {{time}}\n📍 {{venue}}\n\n🅿️ Parking available\n🎫 Show this message\n\nSee you! 🎉", category: 'notification' },
      { name: 'Wedding Invite', body: "With joy, we invite you to the wedding of\n\n💍 *{{bride_name}}* & *{{groom_name}}*\n\n📅 {{date}} at {{time}}\n📍 {{venue}}\n🍽️ {{food_type}}\n\nYour presence = our blessing! 🙏✨\nRSVP: {{phone}}", category: 'greeting' },
      { name: 'Event Thank You', body: "Hi {{name}}, thank you for attending *{{event_name}}*! 🙏\n\nHope you had a great time! 🎉\n\n📸 Photos: {{gallery_link}}\n📝 Feedback: {{feedback_link}}\n\nSee you next time! ✨", category: 'greeting' },
    ],
  },
  {
    category: 'Customer Support',
    icon: '🎧',
    templates: [
      { name: 'Ticket Created', body: "Hi {{name}}, support ticket created! 🎫\n\n🔢 ID: {{ticket_id}}\n📋 Issue: {{issue}}\n⏰ Resolution: {{hours}} hrs\n\nWe're on it! 📞 Urgent? {{phone}}", category: 'notification' },
      { name: 'Ticket Resolved', body: "Hi {{name}}, ticket *#{{ticket_id}}* resolved! ✅\n\n📋 {{issue}}\n🔧 {{resolution}}\n\nStill an issue? Reply REOPEN.\n⭐ Rate us: {{rating_link}}\n\nThank you! 🙏", category: 'notification' },
      { name: 'Feedback Survey', body: "Hi {{name}}, rate your experience! 📊\n\n1️⃣ Poor\n2️⃣ Below Average\n3️⃣ Average\n4️⃣ Good\n5️⃣ Excellent\n\nReply with a number! 🙏", category: 'general' },
    ],
  },
];

// WhatsApp-style chat preview component
function WhatsAppPreview({ body, name, media: rawMedia, onClose }) {
  const media = rawMedia ? (typeof rawMedia === 'string' ? JSON.parse(rawMedia) : rawMedia) : [];
  const [sampleVars, setSampleVars] = useState({});
  const vars = [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

  // Default sample values
  const defaults = {
    name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@email.com',
    amount: '2,499', order_id: 'ORD-10234', date: '18 Mar 2026',
    time: '10:30 AM', product: 'Wireless Earbuds', tracking_id: 'TRK9876543',
    link: 'https://example.com', code: 'SAVE20', discount: '20',
    otp: '847291', minutes: '10', plan: 'Starter', event: 'Product Launch',
    venue: 'Grand Ballroom, Mumbai', invoice_id: 'INV-5678', reward: '500',
    festival: 'Diwali', topic: 'our last discussion', start_time: '2:00 AM',
    end_time: '4:00 AM', items: '2x T-Shirt, 1x Jeans', payment_mode: 'UPI',
    tracking_link: 'https://track.example.com', courier_name: 'Delhivery',
    category: 'Electronics', refund_method: 'Original payment method',
    new_price: '1,299', old_price: '1,999', cashback: '100',
    payment_link: 'https://pay.example.com', restaurant_name: 'Spice Garden',
    guests: '4', address: '123 MG Road, Mumbai', menu_highlights: 'Chef Special Thali, Paneer Tikka',
    season: 'Winter', points: '250', total_points: '1,200', redeem_points: '500',
    discount_amount: '100', doctor_name: 'Priya Sharma', department: 'General Medicine',
    clinic_address: 'Apollo Clinic, Andheri', test_name: 'Complete Blood Count',
    report_link: 'https://reports.example.com', medicine_name: 'Paracetamol 500mg',
    dosage: '1 tablet after food', package_name: 'Full Body Checkup',
    original_price: '4,999', tests: 'CBC, Lipid, Thyroid, Sugar, Liver',
    course_name: 'Web Development', start_date: '1 Apr 2026', timing: '7-9 PM',
    instructor: 'Amit Kumar', group_link: 'https://chat.whatsapp.com/xyz',
    material_link: 'https://drive.google.com', subject: 'JavaScript',
    teacher: 'Prof. Mehta', syllabus_link: 'https://example.com/syllabus',
    score: '87', total: '100', grade: 'A+', fee: '25,000', early_fee: '22,500',
    seats: '20', late_fee: '500', project_name: 'Sky Heights', location: 'Noida Sec 150',
    config: '2 BHK', price: '75,00,000', area: '1,250',
    gallery_link: 'https://gallery.example.com', executive_name: 'Vikash Singh',
    maps_link: 'https://maps.google.com', down_payment: '15,00,000',
    loan_amount: '60,00,000', tenure: '20', emi: '52,000',
    progress: '65', possession_date: 'Dec 2027', brochure_link: 'https://brochure.example.com',
    price_link: 'https://prices.example.com', loan_link: 'https://loans.example.com',
    agent_name: 'Vikash', gym_name: 'FitZone', plan_name: 'Annual',
    end_date: '31 Mar 2027', member_id: 'FZ-1234', workout_type: 'Upper Body',
    streak: '15', fitness_tip: 'Stay hydrated!', bonus: '5',
    goal: 'Weight Loss', calories: '1,800', breakfast: 'Oats + Fruits',
    lunch: 'Dal + Roti + Sabzi', dinner: 'Grilled Chicken + Salad',
    snacks: 'Nuts + Green Tea', service: 'Haircut + Beard Trim',
    stylist: 'Rohit', salon_name: 'Style Studio', offer_name: 'Monsoon Glow Package',
    services: 'Facial + Manicure + Pedicure', savings: '800',
    quote_id: 'QT-2026-001', company: 'TechServe Solutions',
    invoice_link: 'https://invoice.example.com', review_link: 'https://g.page/review',
    person: 'Rajesh Gupta', meeting_link: 'https://meet.google.com/abc',
    event_name: 'Annual Meetup 2026', dress_code: 'Smart Casual',
    bride_name: 'Priya', groom_name: 'Arjun', food_type: 'Veg & Non-Veg',
    feedback_link: 'https://feedback.example.com', organizer: 'Team Events',
    ticket_id: 'TKT-4567', issue: 'Login not working', hours: '24',
    resolution: 'Password reset link sent', rating_link: 'https://rate.example.com',
    extra_discount: '5',
  };

  useEffect(() => {
    const initial = {};
    vars.forEach((v) => (initial[v] = defaults[v] || `[${v}]`));
    setSampleVars(initial);
  }, [body]);

  const rendered = body.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleVars[key] || `[${key}]`);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Phone frame */}
        <div className="bg-gray-900 rounded-3xl p-2 shadow-2xl">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1 text-white text-xs">
            <span>{timeStr}</span>
            <div className="flex gap-1 items-center">
              <div className="w-3.5 h-2 border border-white rounded-sm relative">
                <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }} />
              </div>
            </div>
          </div>

          {/* WhatsApp header */}
          <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3 rounded-t-2xl">
            <button onClick={onClose} className="text-white">
              <X size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600">
              WA
            </div>
            <div className="text-white">
              <p className="font-semibold text-sm">+91 98765 43210</p>
              <p className="text-xs text-white/80">online</p>
            </div>
          </div>

          {/* Chat area */}
          <div
            className="px-3 py-4 min-h-[320px] flex flex-col justify-end"
            style={{
              backgroundColor: '#e5ddd5',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c8c3ba\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          >
            {/* Sent message bubble */}
            <div className="flex justify-end mb-1">
              <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none max-w-[85%] shadow-sm relative overflow-hidden">
                {/* Carousel images */}
                {media.length > 0 && (
                  <div className={media.length === 1 ? '' : 'flex gap-0.5 overflow-x-auto'}>
                    {media.map((img, i) => (
                      <div key={i} className={media.length === 1 ? 'w-full' : 'flex-shrink-0 w-48'}>
                        <img src={img.url} alt="" className="w-full h-40 object-cover" />
                        {img.caption && <p className="text-[10px] text-gray-500 px-2 py-0.5">{img.caption}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-3 py-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{rendered}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-gray-500">{timeStr}</span>
                  <svg width="16" height="11" viewBox="0 0 16 11" className="text-[#4fc3f7]">
                    <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.343-.15.486.486 0 0 0-.343.15l-.546.547a.505.505 0 0 0 0 .689l2.787 2.926c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                    <path fill="currentColor" d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.462.462 1.893 1.986c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                  </svg>
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 rounded-b-2xl">
            <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-400">
              Type a message
            </div>
            <div className="w-10 h-10 bg-[#075e54] rounded-full flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.239 1.816-13.239 1.817-.011 7.912z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Variable editor below phone */}
        {vars.length > 0 && (
          <div className="mt-4 bg-white rounded-xl p-4 shadow-lg">
            <p className="text-sm font-semibold text-gray-700 mb-3">Edit sample values:</p>
            <div className="grid grid-cols-2 gap-2">
              {vars.map((v) => (
                <div key={v}>
                  <label className="text-xs text-gray-500 mb-0.5 block">{`{{${v}}}`}</label>
                  <input
                    value={sampleVars[v] || ''}
                    onChange={(e) => setSampleVars({ ...sampleVars, [v]: e.target.value })}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template info */}
        <div className="mt-3 text-center">
          <p className="text-white text-sm font-medium">{name}</p>
          <p className="text-white/60 text-xs mt-1">Click outside or X to close</p>
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', body: '', category: 'general', media: [] });
  const [uploading, setUploading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [libCategory, setLibCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const load = () => api.get('/templates').then((res) => setTemplates(res.data.templates));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/templates/${editing}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/templates', form);
        toast.success('Template created');
      }
      setForm({ name: '', body: '', category: 'general', media: [] });
      setEditing(null);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (form.media.length >= 10) return toast.error('Maximum 10 images allowed');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/templates/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ ...form, media: [...form.media, { url: res.data.url, filename: res.data.filename, caption: '' }] });
    } catch (err) {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = async (idx) => {
    const img = form.media[idx];
    if (img.filename) {
      try { await api.delete(`/templates/upload-image/${img.filename}`); } catch {}
    }
    setForm({ ...form, media: form.media.filter((_, i) => i !== idx) });
  };

  const updateCaption = (idx, caption) => {
    const updated = [...form.media];
    updated[idx] = { ...updated[idx], caption };
    setForm({ ...form, media: updated });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await api.delete(`/templates/${id}`);
    toast.success('Deleted');
    load();
  };

  const handleEdit = (t) => {
    const media = t.media ? (typeof t.media === 'string' ? JSON.parse(t.media) : t.media) : [];
    setForm({ name: t.name, body: t.body, category: t.category, media });
    setEditing(t.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = async (t) => {
    try {
      const media = t.media ? (typeof t.media === 'string' ? JSON.parse(t.media) : t.media) : [];
      await api.post('/templates', { name: `${t.name} (Copy)`, body: t.body, category: t.category, media });
      toast.success('Template duplicated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to duplicate');
    }
  };

  const handleCopy = (t) => {
    navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addFromLibrary = async (tpl) => {
    try {
      await api.post('/templates', { name: tpl.name, body: tpl.body, category: tpl.category });
      toast.success(`"${tpl.name}" added!`);
      load();
    } catch (err) {
      if (err.response?.status === 409) toast.error('Template with this name already exists');
      else toast.error(err.response?.data?.error || 'Failed to add');
    }
  };

  const vars = [...new Set([...form.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

  const categoryConfig = {
    general: { color: 'bg-gray-100 text-gray-600', border: 'border-l-gray-400', icon: '📋' },
    greeting: { color: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]', border: 'border-l-[var(--color-primary)]', icon: '👋' },
    notification: { color: 'bg-blue-100 text-blue-700', border: 'border-l-blue-500', icon: '🔔' },
    marketing: { color: 'bg-purple-100 text-purple-700', border: 'border-l-purple-500', icon: '📣' },
  };

  const filtered = templates
    .filter(t => !filterCategory || t.category === filterCategory)
    .filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.body.toLowerCase().includes(searchQuery.toLowerCase()));

  const catCounts = { greeting: 0, notification: 0, marketing: 0, general: 0 };
  templates.forEach(t => { if (catCounts[t.category] !== undefined) catCounts[t.category]++; });

  return (
    <div>
      {/* Header */}
      <div className="bg-[var(--color-primary)] rounded-2xl p-4 md:p-6 mb-4 md:mb-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <FileText size={24} className="hidden sm:block" /> Message Templates
            </h2>
            <p className="text-white/80 mt-1 text-xs md:text-sm">Create, manage and preview your WhatsApp message templates</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-white/20 backdrop-blur text-white rounded-xl hover:bg-white/30 transition font-medium text-xs md:text-sm"
            >
              <Sparkles size={14} /> Library
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ name: '', body: '', category: 'general', media: [] }); }}
              className="flex items-center gap-1.5 px-3 md:px-5 py-2 bg-white text-[var(--color-primary-dark)] rounded-xl hover:bg-[var(--color-primary-light)] transition font-semibold text-xs md:text-sm shadow-lg"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Cancel' : 'New'}
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="flex gap-2 md:gap-3 mt-4 md:mt-5 overflow-x-auto pb-1">
          {[
            { label: 'Total', value: templates.length, color: 'bg-white/20' },
            { label: 'Greeting', value: catCounts.greeting, color: 'bg-[var(--color-primary)]/30' },
            { label: 'Notification', value: catCounts.notification, color: 'bg-blue-500/30' },
            { label: 'Marketing', value: catCounts.marketing, color: 'bg-purple-500/30' },
            { label: 'General', value: catCounts.general, color: 'bg-gray-500/30' },
          ].map(s => (
            <div key={s.label} className={`${s.color} backdrop-blur rounded-xl px-3 md:px-4 py-2 md:py-3 text-center flex-1 min-w-[60px]`}>
              <p className="text-xl md:text-2xl font-bold">{s.value}</p>
              <p className="text-[10px] md:text-xs text-white/80">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl border mb-4 md:mb-6 overflow-hidden">
          <div className="bg-[var(--color-primary-light)] px-4 md:px-6 py-3 md:py-4 border-b">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              {editing ? <Edit2 size={18} /> : <Plus size={18} />}
              {editing ? 'Edit Template' : 'Create New Template'}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Template Name</label>
                <input
                  placeholder="e.g. Order Confirmation, Welcome Message..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none transition text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none transition text-sm"
                >
                  <option value="general">📋 General</option>
                  <option value="marketing">📣 Marketing</option>
                  <option value="notification">🔔 Notification</option>
                  <option value="greeting">👋 Greeting</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Message Body</label>
                <span className={`text-xs font-medium ${form.body.length > 4000 ? 'text-red-500' : 'text-gray-400'}`}>
                  {form.body.length} / 4096 characters
                </span>
              </div>
              <textarea
                placeholder="Type your message here...&#10;&#10;Use {{name}}, {{phone}}, {{order_id}} etc. for dynamic variables.&#10;Use *bold*, _italic_ for WhatsApp formatting."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
                rows={6}
                className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none transition text-sm font-mono leading-relaxed"
              />
            </div>

            {vars.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap bg-blue-50 rounded-xl px-4 py-3">
                <Hash size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-700">Variables detected:</span>
                {vars.map((v) => (
                  <span key={v} className="inline-flex items-center bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-mono font-medium">{`{{${v}}}`}</span>
                ))}
              </div>
            )}

            {/* Carousel Images */}
            <div className="border-2 border-dashed rounded-xl p-5 bg-gray-50/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ImagePlus size={18} className="text-[var(--color-primary)]" /> Carousel Images
                  <span className="text-xs font-normal text-gray-400">({form.media.length}/10)</span>
                </label>
                <label className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer transition ${uploading ? 'bg-gray-200 text-gray-400' : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-sm'}`}>
                  {uploading ? 'Uploading...' : '+ Add Image'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                </label>
              </div>
              {form.media.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {form.media.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img.url} alt={`Slide ${idx + 1}`} className="w-full h-28 object-cover rounded-xl border-2 border-gray-200 group-hover:border-[var(--color-primary)] transition" />
                      <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">{idx + 1}</div>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                      >
                        <X size={14} />
                      </button>
                      <input
                        placeholder="Caption..."
                        value={img.caption || ''}
                        onChange={(e) => updateCaption(idx, e.target.value)}
                        className="w-full mt-1.5 px-2.5 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <ImagePlus size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">No images added yet. Upload images for carousel messages.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition font-semibold shadow-sm">
                <Check size={16} /> {editing ? 'Update Template' : 'Create Template'}
              </button>
              {form.body && (
                <button
                  type="button"
                  onClick={() => setPreviewTemplate({ name: form.name || 'Preview', body: form.body, media: form.media })}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
                >
                  <Eye size={16} /> Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); setForm({ name: '', body: '', category: 'general', media: [] }); }}
                className="px-5 py-2.5 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none transition text-sm bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 mb-4 md:mb-5 overflow-x-auto pb-1">
        {[
          { key: '', label: 'All', icon: '' },
          { key: 'greeting', label: 'Greeting', icon: '👋' },
          { key: 'notification', label: 'Notification', icon: '🔔' },
          { key: 'marketing', label: 'Marketing', icon: '📣' },
          { key: 'general', label: 'General', icon: '📋' },
        ].map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilterCategory(cat.key)}
            className={`px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              filterCategory === cat.key
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-100 hover:border-gray-200'
            }`}
          >
            {cat.icon && <span>{cat.icon}</span>}
            {cat.key === '' ? `All (${templates.length})` : `${cat.label} (${catCounts[cat.key] || 0})`}
          </button>
        ))}
      </div>

      {/* Template grid/list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {searchQuery ? `No templates matching "${searchQuery}"` : 'No templates found'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery ? 'Try a different search term' : 'Create your first template or pick from the library'}
          </p>
          {!searchQuery && (
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-primary-dark)] transition">
                <Plus size={14} className="inline mr-1" /> Create Template
              </button>
              <button onClick={() => setShowLibrary(true)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                <Sparkles size={14} className="inline mr-1" /> Browse Library
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {filtered.map((t) => {
            const cat = categoryConfig[t.category] || categoryConfig.general;
            const media = t.media ? (typeof t.media === 'string' ? JSON.parse(t.media) : t.media) : [];
            const tplVars = t.variables ? JSON.parse(t.variables) : [];
            const updatedDate = t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

            if (viewMode === 'list') {
              return (
                <div key={t.id} className={`bg-white rounded-xl border-2 border-gray-100 hover:border-[var(--color-primary-medium)] hover:shadow-md transition p-3 sm:p-4 border-l-4 ${cat.border}`}>
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-800 truncate text-sm sm:text-base">{t.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${cat.color}`}>
                          {cat.icon} {t.category}
                        </span>
                        {media.length > 0 && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                            {media.length} img
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{t.body}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {tplVars.length > 0 && (
                          <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                            <Hash size={10} /> {tplVars.length} variables
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{t.body.length} chars</span>
                        {updatedDate && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock size={10} /> {updatedDate}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setPreviewTemplate(t)} className="p-1.5 sm:p-2 hover:bg-[var(--color-primary-light)] rounded-lg transition" title="Preview">
                        <Eye size={14} className="text-[var(--color-primary)]" />
                      </button>
                      <button onClick={() => handleCopy(t)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition" title="Copy">
                        {copiedId === t.id ? <Check size={14} className="text-[var(--color-primary)]" /> : <Copy size={14} className="text-gray-400" />}
                      </button>
                      <button onClick={() => handleDuplicate(t)} className="hidden sm:block p-2 hover:bg-blue-50 rounded-lg transition" title="Duplicate">
                        <FileText size={14} className="text-blue-400" />
                      </button>
                      <button onClick={() => handleEdit(t)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition" title="Edit">
                        <Edit2 size={14} className="text-gray-400" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 sm:p-2 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={t.id} className={`bg-white rounded-2xl border-2 border-gray-100 hover:border-[var(--color-primary-medium)] hover:shadow-lg transition-all flex flex-col overflow-hidden group`}>
                {/* Card header with accent */}
                <div className={`px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 border-l-4 ${cat.border}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 truncate text-sm sm:text-[15px]">{t.name}</h3>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cat.color}`}>
                          {cat.icon} {t.category}
                        </span>
                        {media.length > 0 && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                            <ImagePlus size={10} /> {media.length}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{t.body.length} chars</span>
                      </div>
                    </div>
                    {updatedDate && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5 shrink-0 mt-1">
                        <Clock size={10} /> {updatedDate}
                      </span>
                    )}
                  </div>
                </div>

                {/* WhatsApp preview */}
                <div className="px-3 sm:px-4 pb-3 flex-1">
                  <div className="bg-[#e5ddd5] rounded-xl p-2.5 sm:p-3">
                    {media.length > 0 && (
                      <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                        {media.map((img, i) => (
                          <img key={i} src={img.url} alt="" className="w-14 h-14 object-cover rounded-lg border-2 border-white flex-shrink-0 shadow-sm" />
                        ))}
                      </div>
                    )}
                    <div className="bg-[#dcf8c6] rounded-xl rounded-tr-none px-3 py-2.5 max-w-[95%] ml-auto shadow-sm">
                      <p className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-4">{t.body}</p>
                      <div className="flex items-center justify-end gap-1 mt-1.5">
                        <span className="text-[9px] text-gray-400">12:00 pm</span>
                        <svg width="12" height="8" viewBox="0 0 16 11" className="text-[#4fc3f7]">
                          <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.343-.15.486.486 0 0 0-.343.15l-.546.547a.505.505 0 0 0 0 .689l2.787 2.926c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                          <path fill="currentColor" d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.462.462 1.893 1.986c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variables */}
                {tplVars.length > 0 && (
                  <div className="px-3 sm:px-5 pb-3">
                    <div className="flex flex-wrap gap-1">
                      {tplVars.slice(0, 5).map((v) => (
                        <span key={v} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-mono font-medium">{`{{${v}}}`}</span>
                      ))}
                      {tplVars.length > 5 && (
                        <span className="text-[10px] text-gray-400 self-center">+{tplVars.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 px-2 sm:px-3 py-2 sm:py-2.5 border-t bg-gray-50/50">
                  <button
                    onClick={() => setPreviewTemplate(t)}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs text-[var(--color-primary-dark)] hover:bg-[var(--color-primary-medium)] rounded-lg transition font-medium"
                    title="Preview"
                  >
                    <Eye size={13} /> <span className="hidden sm:inline">Preview</span>
                  </button>
                  <button
                    onClick={() => handleCopy(t)}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium"
                    title="Copy"
                  >
                    {copiedId === t.id ? <Check size={13} className="text-[var(--color-primary)]" /> : <Copy size={13} />}
                    <span className="hidden sm:inline">{copiedId === t.id ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleDuplicate(t)}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
                    title="Duplicate template"
                  >
                    <FileText size={13} /> <span className="hidden sm:inline">Clone</span>
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => handleEdit(t)} className="p-1.5 sm:p-2 hover:bg-gray-200 rounded-lg transition" title="Edit">
                    <Edit2 size={13} className="text-gray-500" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 sm:p-2 hover:bg-red-100 rounded-lg transition" title="Delete">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full preview modal */}
      {previewTemplate && (
        <WhatsAppPreview
          body={previewTemplate.body}
          name={previewTemplate.name}
          media={previewTemplate.media}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {/* Template Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm" onClick={() => setShowLibrary(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[95vh] sm:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 md:p-6 border-b bg-[var(--color-primary-light)] rounded-t-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-[var(--color-primary)]" /> Template Library</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Pick pre-built templates for your industry</p>
              </div>
              <button onClick={() => setShowLibrary(false)} className="p-2 hover:bg-white rounded-xl transition"><X size={20} /></button>
            </div>

            <div className="px-3 md:px-6 pt-3 md:pt-4 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 shrink-0">
              <button onClick={() => setLibCategory('')} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition whitespace-nowrap shrink-0 ${!libCategory ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                All ({templateLibrary.reduce((s, c) => s + c.templates.length, 0)})
              </button>
              {templateLibrary.map(cat => (
                <button key={cat.category} onClick={() => setLibCategory(cat.category)} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition whitespace-nowrap shrink-0 ${libCategory === cat.category ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {cat.icon} {cat.category} ({cat.templates.length})
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-3 md:p-6 flex-1">
              {(libCategory ? templateLibrary.filter(c => c.category === libCategory) : templateLibrary).map(cat => (
                <div key={cat.category} className="mb-5 last:mb-0">
                  <h4 className="text-sm font-bold text-gray-700 mb-2.5 flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span> {cat.category}
                    <span className="text-xs text-gray-400 font-normal">({cat.templates.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {cat.templates.map((tpl, i) => {
                      const exists = templates.some(t => t.name === tpl.name);
                      return (
                        <div key={i} className="border-2 rounded-xl p-3 sm:p-4 hover:border-[var(--color-primary-medium)] hover:bg-[var(--color-primary-light)] transition">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h5 className="font-semibold text-sm text-gray-800 truncate">{tpl.name}</h5>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                tpl.category === 'notification' ? 'bg-blue-100 text-blue-700' :
                                tpl.category === 'marketing' ? 'bg-purple-100 text-purple-700' :
                                tpl.category === 'greeting' ? 'bg-[var(--color-primary-medium)] text-[var(--color-primary-dark)]' :
                                'bg-gray-100 text-gray-600'
                              }`}>{tpl.category}</span>
                            </div>
                            {exists ? (
                              <span className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1 shrink-0"><Check size={12} /> Added</span>
                            ) : (
                              <button onClick={() => addFromLibrary(tpl)} className="px-2.5 sm:px-3 py-1.5 text-xs bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition font-medium shadow-sm shrink-0">
                                + Add
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">{tpl.body}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
