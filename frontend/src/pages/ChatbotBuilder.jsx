import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Play, X, GripVertical, MessageSquare, ArrowRight, ChevronDown, ChevronUp, Copy, Save, Upload, Send, FileSpreadsheet, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ImagePlus, User, Calendar, CalendarDays, CalendarRange, Repeat, Settings2, Link2, Unlink, Megaphone, Bot, StopCircle, Pause, RotateCcw, Eye, Edit3, MoreVertical, Hash, Zap, Shield, Target } from 'lucide-react';
import toast from '../utils/notify.js';
import api from '../api/client.js';
import CampaignBuilder from './CampaignBuilder.jsx';
import WarmUpSelector, { getWarmupLimit, WARMUP_LIMITS } from '../components/WarmUpSelector.jsx';
import WarmUpLimitPopup from '../components/WarmUpLimitPopup.jsx';

// ── Pre-defined Chatbot Templates ──
const chatbotTemplates = [
  {
    id: 'real_estate',
    name: 'Real Estate Follow-up Bot',
    category: 'Real Estate',
    icon: '🏠',
    description: 'Automated lead follow-up for real estate. Engages leads, checks interest, shows projects, schedules calls.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Hello! This is *{{agent_name}}*, Sales Manager from *{{company}}*. 👋\n\n🌐 Website: https://www.example.com\n\nAre you still looking for a place, or did you find one already?\n\n━━━━━━━━━━━━━━━━━━━━\n👇 *Please reply with a number:*\n\n  1️⃣  Yes\n  2️⃣  No\n  3️⃣  Just gathering Information for future", options: [{ label: '1 - Yes, still looking', next: 'brochure' }, { label: '2 - No, found a place', next: 'found_place' }, { label: '3 - Just browsing', next: 'just_browsing' }] },
      { id: 'brochure', name: 'Brochure & Call', message: "I will just drop the project brochure here for you to review at your own pace. 📄\n\n📋 *Project Specification:* https://example.com/projects/\n\n━━━━━━━━━━━━━━━━━━━━\n\nWould you like a call to discuss further?\n\n  1️⃣  09:30 AM to 12:30 PM\n  2️⃣  02:00 PM to 06:00 PM\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Morning slot', next: 'call_confirmed' }, { label: '2 - Afternoon slot', next: 'call_confirmed' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'call_confirmed', name: 'Call Confirmed', message: "Our team will reach out to you shortly! 🙏\n\n*Call scheduled.* We'll notify your assigned executive.", options: [] },
      { id: 'found_place', name: 'Found a Place', message: "Congrats on finding your spot! 🎉\n\nDo you know anyone else looking? We'd appreciate the recommendation. 🙏\n\nThank you!", options: [] },
      { id: 'just_browsing', name: 'Just Browsing', message: "No pressure! We just want to know:\n\n  1️⃣  Waiting for a milestone (Job / Move / Market Change)?\n  2️⃣  Just keeping an eye on designs?\n\n  0️⃣  Go Back", options: [{ label: '1 - Waiting for milestone', next: 'follow_up_3m' }, { label: '2 - Keeping eye on designs', next: 'found_place' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'follow_up_3m', name: '3-Month Follow-up', message: "Should I check in 3 months or only message you if there is a major price drop / new launch?\n\n  1️⃣  Yes, check in 3 months\n  2️⃣  No thanks\n\n  0️⃣  Go Back", options: [{ label: '1 - Yes', next: 'follow_confirmed' }, { label: '2 - No', next: 'goodbye' }, { label: '0 - Back', next: 'just_browsing' }] },
      { id: 'follow_confirmed', name: 'Follow-up Confirmed', message: "Noted! 📝 We'll send you a *quarterly update* and let you know first about any price changes.\n\nThanks for staying connected! 🙏", options: [] },
      { id: 'goodbye', name: 'Goodbye', message: "No problem! Feel free to reach out anytime.\n\nThank you for your time! 🙏", options: [] },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Support Bot',
    category: 'E-Commerce',
    icon: '🛒',
    description: 'Customer support bot for online stores. Handles order status, returns, product queries, and complaints.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Welcome to *{{company}}*! 🛍️\n\nHow can we help you today?\n\n  1️⃣  Track my order\n  2️⃣  Return / Exchange\n  3️⃣  Product inquiry\n  4️⃣  Talk to support", options: [{ label: '1 - Track order', next: 'track_order' }, { label: '2 - Return/Exchange', next: 'return' }, { label: '3 - Product inquiry', next: 'product_inquiry' }, { label: '4 - Talk to support', next: 'human_support' }] },
      { id: 'track_order', name: 'Track Order', message: "Please share your *Order ID* (e.g. #12345).\n\nYou can find it in your order confirmation email or SMS.\n\n  0️⃣  Back to Menu", options: [{ label: '0 - Back', next: 'welcome' }] },
      { id: 'return', name: 'Return / Exchange', message: "We're sorry to hear that! 😔\n\nWhat would you like to do?\n\n  1️⃣  Return the product (refund)\n  2️⃣  Exchange for a different size/color\n  3️⃣  Product is damaged/defective\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Return', next: 'return_process' }, { label: '2 - Exchange', next: 'return_process' }, { label: '3 - Damaged', next: 'return_process' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'return_process', name: 'Return Process', message: "To process your request:\n\n1. Share your *Order ID*\n2. Send a *photo* of the product\n3. Our team will arrange pickup within *24-48 hours*\n\nPlease share your Order ID now. Our team will get back to you shortly! 📦", options: [] },
      { id: 'product_inquiry', name: 'Product Inquiry', message: "What would you like to know?\n\n  1️⃣  Product availability\n  2️⃣  Pricing & offers\n  3️⃣  Bulk order inquiry\n  4️⃣  Shipping details\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Availability', next: 'product_detail' }, { label: '2 - Pricing', next: 'product_detail' }, { label: '3 - Bulk order', next: 'human_support' }, { label: '4 - Shipping', next: 'shipping_info' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'product_detail', name: 'Product Details', message: "Please share the *product name* or *link* you're interested in.\n\nOur team will share all the details with you shortly! 🎯", options: [] },
      { id: 'shipping_info', name: 'Shipping Info', message: "📦 *Shipping Details:*\n\n• Standard Delivery: 5-7 business days\n• Express Delivery: 2-3 business days\n• Free shipping on orders above ₹999\n• Cash on Delivery available\n\nNeed anything else?\n\n  1️⃣  Yes, more help\n  2️⃣  No, thanks!", options: [{ label: '1 - More help', next: 'welcome' }, { label: '2 - No thanks', next: 'goodbye' }] },
      { id: 'human_support', name: 'Human Support', message: "Our support executive will connect with you shortly! 👨‍💼\n\n⏰ *Support Hours:* Mon-Sat, 10 AM - 7 PM\n\nPlease share your query and we'll get back to you ASAP. 🙏", options: [] },
      { id: 'goodbye', name: 'Goodbye', message: "Thank you for shopping with *{{company}}*! 🙏\n\nHave a great day! ❤️", options: [] },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant Order Bot',
    category: 'Food & Restaurant',
    icon: '🍽️',
    description: 'Take food orders, share menu, handle reservations, and collect feedback for restaurants.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Welcome to *{{company}}*! 🍽️\n\nWhat would you like to do?\n\n  1️⃣  View Menu\n  2️⃣  Place an Order\n  3️⃣  Table Reservation\n  4️⃣  Today's Special\n  5️⃣  Share Feedback", options: [{ label: '1 - View Menu', next: 'menu' }, { label: '2 - Place Order', next: 'order' }, { label: '3 - Reservation', next: 'reservation' }, { label: '4 - Today Special', next: 'special' }, { label: '5 - Feedback', next: 'feedback' }] },
      { id: 'menu', name: 'Menu', message: "📋 *Our Menu Categories:*\n\n  1️⃣  Starters & Appetizers\n  2️⃣  Main Course\n  3️⃣  Biryani & Rice\n  4️⃣  Breads\n  5️⃣  Desserts & Beverages\n\nFull menu: {{menu_link}}\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Starters', next: 'order' }, { label: '2 - Main Course', next: 'order' }, { label: '3 - Biryani', next: 'order' }, { label: '4 - Breads', next: 'order' }, { label: '5 - Desserts', next: 'order' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'order', name: 'Place Order', message: "To place your order, please share:\n\n1. *Items & quantity* (e.g. 2x Butter Chicken, 1x Naan)\n2. *Delivery or Pickup?*\n3. *Address* (if delivery)\n\nMinimum order: ₹300\nDelivery charges: ₹50 (Free above ₹700)\n\n  0️⃣  Back to Menu", options: [{ label: '0 - Back', next: 'welcome' }] },
      { id: 'reservation', name: 'Reservation', message: "🪑 *Table Reservation*\n\nPlease share:\n1. *Date & Time*\n2. *Number of guests*\n3. *Any special request* (birthday, anniversary, etc.)\n\nWe'll confirm your booking shortly! 📞\n\n  0️⃣  Back to Menu", options: [{ label: '0 - Back', next: 'welcome' }] },
      { id: 'special', name: "Today's Special", message: "🌟 *Today's Special:*\n\n🔥 *Chef's Special Thali* - ₹399\nIncludes: Dal, Paneer, Sabzi, Rice, 2 Roti, Raita, Dessert\n\n🍗 *Chicken Biryani Combo* - ₹349\nIncludes: Biryani, Raita, Salan\n\n📢 *20% OFF* on orders above ₹999! Use code: TODAY20\n\n  1️⃣  Order Now\n  0️⃣  Back to Menu", options: [{ label: '1 - Order Now', next: 'order' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'feedback', name: 'Feedback', message: "We'd love to hear from you! 💬\n\nHow was your experience?\n\n  1️⃣  Excellent 🌟\n  2️⃣  Good 👍\n  3️⃣  Average 😐\n  4️⃣  Need Improvement 👎\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Excellent', next: 'feedback_thanks' }, { label: '2 - Good', next: 'feedback_thanks' }, { label: '3 - Average', next: 'feedback_improve' }, { label: '4 - Needs Improvement', next: 'feedback_improve' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'feedback_thanks', name: 'Thanks', message: "Thank you so much! 🙏❤️\n\nWe're glad you enjoyed your experience. See you again soon! 🍽️", options: [] },
      { id: 'feedback_improve', name: 'Improve', message: "We're sorry to hear that. 😔\n\nPlease share what went wrong — your feedback helps us improve.\n\nOur manager will personally look into this. 🙏", options: [] },
    ],
  },
  {
    id: 'appointment',
    name: 'Appointment Booking Bot',
    category: 'Healthcare / Salon',
    icon: '📅',
    description: 'Book appointments for clinics, salons, consultants. Handles time slots, services, and confirmations.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Hello! Welcome to *{{company}}* 👋\n\nHow can we help you today?\n\n  1️⃣  Book an Appointment\n  2️⃣  Check Available Slots\n  3️⃣  Reschedule / Cancel\n  4️⃣  Our Services\n  5️⃣  Location & Contact", options: [{ label: '1 - Book Appointment', next: 'select_service' }, { label: '2 - Available Slots', next: 'slots' }, { label: '3 - Reschedule', next: 'reschedule' }, { label: '4 - Services', next: 'services' }, { label: '5 - Contact', next: 'contact' }] },
      { id: 'select_service', name: 'Select Service', message: "Which service would you like to book?\n\n  1️⃣  General Consultation\n  2️⃣  Follow-up Visit\n  3️⃣  Specialist Consultation\n  4️⃣  Lab Tests / Reports\n\n  0️⃣  Back to Menu", options: [{ label: '1 - General', next: 'slots' }, { label: '2 - Follow-up', next: 'slots' }, { label: '3 - Specialist', next: 'slots' }, { label: '4 - Lab Tests', next: 'slots' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'slots', name: 'Available Slots', message: "📅 *Available Slots:*\n\n*Today:*\n  1️⃣  10:00 AM\n  2️⃣  11:30 AM\n  3️⃣  02:00 PM\n  4️⃣  04:30 PM\n\n*Tomorrow:*\n  5️⃣  09:00 AM\n  6️⃣  01:00 PM\n  7️⃣  03:30 PM\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Today 10:00 AM', next: 'confirm' }, { label: '2 - Today 11:30 AM', next: 'confirm' }, { label: '3 - Today 2:00 PM', next: 'confirm' }, { label: '4 - Today 4:30 PM', next: 'confirm' }, { label: '5 - Tomorrow 9:00 AM', next: 'confirm' }, { label: '6 - Tomorrow 1:00 PM', next: 'confirm' }, { label: '7 - Tomorrow 3:30 PM', next: 'confirm' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'confirm', name: 'Confirm Booking', message: "Your appointment is *confirmed*! ✅\n\n📍 *Location:* {{address}}\n📞 *Contact:* {{phone}}\n\n⚠️ Please arrive 10 minutes early.\n\nNeed anything else?\n\n  1️⃣  Yes\n  2️⃣  No, thanks!", options: [{ label: '1 - Yes', next: 'welcome' }, { label: '2 - No thanks', next: 'goodbye' }] },
      { id: 'reschedule', name: 'Reschedule', message: "To reschedule or cancel, please share your *Booking ID* or *registered phone number*.\n\nOur team will assist you shortly. 📞\n\n  0️⃣  Back to Menu", options: [{ label: '0 - Back', next: 'welcome' }] },
      { id: 'services', name: 'Services', message: "🏥 *Our Services:*\n\n• General Consultation - ₹500\n• Specialist Consultation - ₹1,000\n• Follow-up Visit - ₹300\n• Lab Tests - Starting ₹200\n• Health Checkup Package - ₹2,999\n\n  1️⃣  Book Now\n  0️⃣  Back to Menu", options: [{ label: '1 - Book Now', next: 'select_service' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'contact', name: 'Contact', message: "📍 *{{company}}*\n\n🏢 Address: {{address}}\n📞 Phone: {{phone}}\n⏰ Hours: Mon-Sat, 9 AM - 8 PM\n🌐 Website: {{website}}\n\n  0️⃣  Back to Menu", options: [{ label: '0 - Back', next: 'welcome' }] },
      { id: 'goodbye', name: 'Goodbye', message: "Thank you! Take care and stay healthy! 🙏💚", options: [] },
    ],
  },
  {
    id: 'education',
    name: 'Course Inquiry Bot',
    category: 'Education',
    icon: '🎓',
    description: 'Handle course inquiries, admissions, fee details, and schedule demo classes for coaching/institutes.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Welcome to *{{company}}*! 🎓\n\nWhat would you like to know?\n\n  1️⃣  Our Courses\n  2️⃣  Fee Structure\n  3️⃣  Book a Free Demo\n  4️⃣  Admission Process\n  5️⃣  Contact Us", options: [{ label: '1 - Courses', next: 'courses' }, { label: '2 - Fee Structure', next: 'fees' }, { label: '3 - Free Demo', next: 'demo' }, { label: '4 - Admission', next: 'admission' }, { label: '5 - Contact', next: 'contact' }] },
      { id: 'courses', name: 'Courses', message: "📚 *Our Courses:*\n\n  1️⃣  Web Development (3 months)\n  2️⃣  Digital Marketing (2 months)\n  3️⃣  Data Science & AI (4 months)\n  4️⃣  Graphic Design (2 months)\n  5️⃣  Spoken English (1 month)\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Web Dev', next: 'course_detail' }, { label: '2 - Digital Marketing', next: 'course_detail' }, { label: '3 - Data Science', next: 'course_detail' }, { label: '4 - Graphic Design', next: 'course_detail' }, { label: '5 - English', next: 'course_detail' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'course_detail', name: 'Course Details', message: "Great choice! 🎯\n\n✅ *What you'll learn:*\n• Industry-relevant curriculum\n• Hands-on projects\n• Certificate on completion\n• Placement assistance\n\n💰 *Special Offer:* Early bird discount available!\n\nWant to know more?\n\n  1️⃣  Book a Free Demo Class\n  2️⃣  Check Fee Structure\n  3️⃣  Talk to Counselor\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Free Demo', next: 'demo' }, { label: '2 - Fees', next: 'fees' }, { label: '3 - Counselor', next: 'counselor' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'fees', name: 'Fee Structure', message: "💰 *Fee Structure:*\n\n• Web Development: ₹25,000\n• Digital Marketing: ₹15,000\n• Data Science & AI: ₹35,000\n• Graphic Design: ₹12,000\n• Spoken English: ₹5,000\n\n📢 *EMI available* | 🎁 *10% early bird discount*\n\n  1️⃣  Enroll Now\n  2️⃣  Book Free Demo First\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Enroll', next: 'admission' }, { label: '2 - Demo first', next: 'demo' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'demo', name: 'Book Demo', message: "🆓 *Book Your Free Demo Class!*\n\nPlease share:\n1. *Your Name*\n2. *Course you're interested in*\n3. *Preferred Date & Time*\n\nWe'll confirm your slot within 1 hour! 📞", options: [] },
      { id: 'admission', name: 'Admission', message: "📝 *Admission Process:*\n\n1. Fill the registration form\n2. Pay registration fee (₹500)\n3. Attend orientation session\n4. Start your batch!\n\n📅 *Next Batch:* Starting {{batch_date}}\n\nTo enroll, please share your *Name* and *Email*. Our counselor will call you! 📞", options: [] },
      { id: 'counselor', name: 'Talk to Counselor', message: "Our counselor will connect with you shortly! 👨‍🏫\n\n📞 You can also call us at: {{phone}}\n⏰ Counseling Hours: Mon-Sat, 10 AM - 7 PM\n\n🙏 Thank you for your interest!", options: [] },
      { id: 'contact', name: 'Contact', message: "📍 *{{company}}*\n\n🏢 {{address}}\n📞 {{phone}}\n📧 {{email}}\n⏰ Mon-Sat, 9 AM - 8 PM\n🌐 {{website}}\n\n  0️⃣  Back to Menu", options: [{ label: '0 - Back', next: 'welcome' }] },
    ],
  },
  {
    id: 'customer_feedback',
    name: 'Customer Feedback Bot',
    category: 'General',
    icon: '⭐',
    description: 'Collect customer feedback, NPS scores, reviews, and handle complaints automatically.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Hi {{name}}! 👋\n\nThank you for choosing *{{company}}*.\n\nWe'd love your feedback on your recent experience!\n\nHow would you rate us?\n\n  1️⃣  ⭐⭐⭐⭐⭐ Excellent\n  2️⃣  ⭐⭐⭐⭐ Good\n  3️⃣  ⭐⭐⭐ Average\n  4️⃣  ⭐⭐ Below Average\n  5️⃣  ⭐ Poor", options: [{ label: '1 - Excellent', next: 'positive' }, { label: '2 - Good', next: 'positive' }, { label: '3 - Average', next: 'improve' }, { label: '4 - Below Average', next: 'negative' }, { label: '5 - Poor', next: 'negative' }] },
      { id: 'positive', name: 'Positive Review', message: "Thank you so much! 🎉❤️\n\nWe're thrilled you had a great experience!\n\nWould you mind leaving us a Google review? It really helps! 🙏\n\n🔗 Review Link: {{review_link}}\n\n  1️⃣  Done! ✅\n  2️⃣  Maybe later", options: [{ label: '1 - Done', next: 'referral' }, { label: '2 - Later', next: 'referral' }] },
      { id: 'improve', name: 'Improvement', message: "Thank you for your honest feedback! 🙏\n\nWhat could we improve?\n\n  1️⃣  Service quality\n  2️⃣  Response time\n  3️⃣  Product quality\n  4️⃣  Pricing\n  5️⃣  Other\n\nYour feedback helps us get better! 💪", options: [{ label: '1 - Service', next: 'noted' }, { label: '2 - Response time', next: 'noted' }, { label: '3 - Product', next: 'noted' }, { label: '4 - Pricing', next: 'noted' }, { label: '5 - Other', next: 'noted' }] },
      { id: 'negative', name: 'Negative Feedback', message: "We're really sorry about your experience. 😔\n\nYour feedback is important to us. Could you briefly describe what went wrong?\n\nOur manager will personally look into this and get back to you within *24 hours*. 📞", options: [] },
      { id: 'noted', name: 'Feedback Noted', message: "Thank you! Your feedback has been noted. 📝\n\nOur team will work on improving this. We value your input! 💙\n\nAnything else you'd like to share?\n\n  1️⃣  Yes\n  2️⃣  No, that's all", options: [{ label: '1 - Yes', next: 'welcome' }, { label: '2 - No', next: 'goodbye' }] },
      { id: 'referral', name: 'Referral', message: "One more thing! 🎁\n\nRefer a friend and get *₹500 off* on your next purchase!\n\nYour referral code: *{{referral_code}}*\n\nThank you for being awesome! 🌟", options: [] },
      { id: 'goodbye', name: 'Goodbye', message: "Thank you for your time and feedback! 🙏\n\nWe're committed to giving you the best experience.\n\nHave a wonderful day! ❤️", options: [] },
    ],
  },
  {
    id: 'lead_qualifier',
    name: 'Lead Qualification Bot',
    category: 'Sales & Marketing',
    icon: '🎯',
    description: 'Qualify incoming leads automatically. Ask budget, timeline, requirements, and route hot leads to sales.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Hi! Thanks for your interest in *{{company}}*! 🎯\n\nTo help you better, I have a few quick questions.\n\nWhat are you looking for?\n\n  1️⃣  Product / Service inquiry\n  2️⃣  Partnership / Collaboration\n  3️⃣  Pricing information\n  4️⃣  Just exploring", options: [{ label: '1 - Product inquiry', next: 'budget' }, { label: '2 - Partnership', next: 'connect_sales' }, { label: '3 - Pricing', next: 'budget' }, { label: '4 - Just exploring', next: 'nurture' }] },
      { id: 'budget', name: 'Budget Check', message: "Great! What's your approximate budget range?\n\n  1️⃣  Under ₹50,000\n  2️⃣  ₹50,000 - ₹2,00,000\n  3️⃣  ₹2,00,000 - ₹5,00,000\n  4️⃣  Above ₹5,00,000\n  5️⃣  Not sure yet", options: [{ label: '1 - Under 50K', next: 'timeline' }, { label: '2 - 50K-2L', next: 'timeline' }, { label: '3 - 2L-5L', next: 'timeline' }, { label: '4 - Above 5L', next: 'timeline' }, { label: '5 - Not sure', next: 'timeline' }] },
      { id: 'timeline', name: 'Timeline', message: "When are you looking to start?\n\n  1️⃣  Immediately / This week\n  2️⃣  Within a month\n  3️⃣  1-3 months\n  4️⃣  Just researching", options: [{ label: '1 - Immediately', next: 'connect_sales' }, { label: '2 - Within month', next: 'connect_sales' }, { label: '3 - 1-3 months', next: 'nurture' }, { label: '4 - Researching', next: 'nurture' }] },
      { id: 'connect_sales', name: 'Connect to Sales', message: "Excellent! 🔥 You seem like a great fit!\n\nI'm connecting you with our sales team right away.\n\n*{{sales_person}}* will reach out to you within *30 minutes* during business hours.\n\n📞 Or call us directly: {{phone}}\n\nThank you! 🙏", options: [] },
      { id: 'nurture', name: 'Nurture Lead', message: "No rush! 😊\n\nWould you like us to:\n\n  1️⃣  Send you our brochure / catalog\n  2️⃣  Add you to our newsletter (offers & updates)\n  3️⃣  Schedule a call for later\n\n  0️⃣  No thanks", options: [{ label: '1 - Send brochure', next: 'brochure_sent' }, { label: '2 - Newsletter', next: 'subscribed' }, { label: '3 - Schedule call', next: 'schedule_call' }, { label: '0 - No thanks', next: 'goodbye' }] },
      { id: 'brochure_sent', name: 'Brochure Sent', message: "📄 Here's our brochure: {{brochure_link}}\n\nFeel free to reach out whenever you're ready!\n\nHave a great day! 🙏", options: [] },
      { id: 'subscribed', name: 'Subscribed', message: "You're subscribed! ✅\n\nYou'll receive exclusive offers and updates from us.\n\nThank you! 🎉", options: [] },
      { id: 'schedule_call', name: 'Schedule Call', message: "Sure! When would be a good time?\n\nPlease share your preferred *date & time*, and we'll arrange a callback.\n\n📞 Our team will confirm the slot!", options: [] },
      { id: 'goodbye', name: 'Goodbye', message: "No worries! Thanks for checking us out. 🙏\n\nFeel free to message us anytime!\n\nHave a great day! ❤️", options: [] },
    ],
  },
  {
    id: 'gym_fitness',
    name: 'Gym & Fitness Bot',
    category: 'Fitness',
    icon: '💪',
    description: 'Handle gym membership inquiries, class schedules, personal training bookings, and diet plan info.',
    steps: [
      { id: 'welcome', name: 'Welcome', message: "Welcome to *{{company}}*! 💪🏋️\n\nHow can we help you?\n\n  1️⃣  Membership Plans\n  2️⃣  Class Schedule\n  3️⃣  Personal Training\n  4️⃣  Diet & Nutrition Plans\n  5️⃣  Free Trial Session", options: [{ label: '1 - Membership', next: 'plans' }, { label: '2 - Schedule', next: 'schedule' }, { label: '3 - Personal Training', next: 'pt' }, { label: '4 - Diet Plan', next: 'diet' }, { label: '5 - Free Trial', next: 'trial' }] },
      { id: 'plans', name: 'Membership Plans', message: "🏋️ *Membership Plans:*\n\n  1️⃣  *Monthly* - ₹1,500/month\n  2️⃣  *Quarterly* - ₹4,000 (Save ₹500)\n  3️⃣  *Half-Yearly* - ₹7,500 (Save ₹1,500)\n  4️⃣  *Annual* - ₹12,000 (Save ₹6,000) 🔥\n\n✅ All plans include: Gym + Cardio + Group Classes\n\n  5️⃣  Join Now!\n  0️⃣  Back to Menu", options: [{ label: '1 - Monthly', next: 'join' }, { label: '2 - Quarterly', next: 'join' }, { label: '3 - Half-Yearly', next: 'join' }, { label: '4 - Annual', next: 'join' }, { label: '5 - Join Now', next: 'join' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'schedule', name: 'Class Schedule', message: "📅 *Today's Classes:*\n\n🧘 6:00 AM - Yoga\n🏋️ 7:00 AM - Strength Training\n💃 9:00 AM - Zumba\n🥊 5:00 PM - Kickboxing\n🧘 7:00 PM - Evening Yoga\n🏃 8:00 PM - HIIT\n\n  1️⃣  Book a Class\n  0️⃣  Back to Menu", options: [{ label: '1 - Book', next: 'join' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'pt', name: 'Personal Training', message: "👨‍🏫 *Personal Training:*\n\n• 1-on-1 sessions with certified trainer\n• Custom workout plan\n• Progress tracking\n• Flexible timing\n\n💰 *₹3,000/month* (12 sessions)\n\n  1️⃣  Book a Session\n  0️⃣  Back to Menu", options: [{ label: '1 - Book', next: 'join' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'diet', name: 'Diet Plan', message: "🥗 *Diet & Nutrition Plans:*\n\n  1️⃣  Weight Loss Plan\n  2️⃣  Muscle Gain Plan\n  3️⃣  General Fitness Plan\n\n💰 *₹2,000/month* - Includes weekly check-ins\n\n  0️⃣  Back to Menu", options: [{ label: '1 - Weight Loss', next: 'join' }, { label: '2 - Muscle Gain', next: 'join' }, { label: '3 - General', next: 'join' }, { label: '0 - Back', next: 'welcome' }] },
      { id: 'trial', name: 'Free Trial', message: "🆓 *Get a FREE Trial Session!*\n\nPlease share:\n1. Your *Name*\n2. *Preferred Date & Time*\n3. Any *fitness goals*\n\nWe'll confirm your slot! 🏋️", options: [] },
      { id: 'join', name: 'Join', message: "Awesome! 🎉\n\nTo join, please share:\n1. *Your Name*\n2. *Phone Number*\n\nOur team will call you to complete the registration!\n\n📍 Visit us: {{address}}\n📞 Call: {{phone}}", options: [] },
    ],
  },
  {
    id: 'event_rsvp',
    name: 'Event RSVP Bot',
    category: 'Events',
    icon: '🎉',
    description: 'Manage event invitations, RSVPs, share event details, directions, and handle plus-ones.',
    steps: [
      { id: 'welcome', name: 'Invitation', message: "You're Invited! 🎉✨\n\n*{{event_name}}*\n\n📅 Date: {{event_date}}\n⏰ Time: {{event_time}}\n📍 Venue: {{venue}}\n\nWill you be joining us?\n\n  1️⃣  Yes, I'll be there! ✅\n  2️⃣  Sorry, can't make it 😔\n  3️⃣  Maybe / Not sure yet", options: [{ label: '1 - Yes', next: 'confirmed' }, { label: '2 - No', next: 'declined' }, { label: '3 - Maybe', next: 'maybe' }] },
      { id: 'confirmed', name: 'Confirmed', message: "Wonderful! 🎊 We're excited to see you!\n\nWill you be bringing anyone?\n\n  1️⃣  Just me\n  2️⃣  +1 (with partner/friend)\n  3️⃣  +2 or more", options: [{ label: '1 - Just me', next: 'details' }, { label: '2 - Plus one', next: 'details' }, { label: '3 - Plus two+', next: 'details' }] },
      { id: 'details', name: 'Event Details', message: "Your RSVP is confirmed! ✅\n\n📋 *Event Details:*\n\n🎨 Dress Code: {{dress_code}}\n🅿️ Parking: Available at venue\n🍽️ Food: {{food_type}}\n\n  1️⃣  Get Directions 📍\n  2️⃣  Add to Calendar 📅\n  3️⃣  Any dietary requirements", options: [{ label: '1 - Directions', next: 'directions' }, { label: '2 - Calendar', next: 'calendar' }, { label: '3 - Dietary', next: 'dietary' }] },
      { id: 'directions', name: 'Directions', message: "📍 *How to reach:*\n\n{{venue}}\n\n🗺️ Google Maps: {{maps_link}}\n\n🚗 By Car: Parking available\n🚇 By Metro: Nearest station — {{metro_station}}\n\nSee you there! 🎉", options: [] },
      { id: 'calendar', name: 'Calendar', message: "📅 Event has been shared!\n\nSave this date: *{{event_date}}* at *{{event_time}}*\n\nWe'll send you a reminder 1 day before! 🔔\n\nSee you there! 🎊", options: [] },
      { id: 'dietary', name: 'Dietary', message: "Please share your dietary requirements:\n\n  1️⃣  Vegetarian\n  2️⃣  Non-Vegetarian\n  3️⃣  Vegan\n  4️⃣  Jain\n  5️⃣  No restrictions", options: [{ label: '1 - Veg', next: 'dietary_noted' }, { label: '2 - Non-Veg', next: 'dietary_noted' }, { label: '3 - Vegan', next: 'dietary_noted' }, { label: '4 - Jain', next: 'dietary_noted' }, { label: '5 - No restrictions', next: 'dietary_noted' }] },
      { id: 'dietary_noted', name: 'Noted', message: "Noted! ✅ We'll make sure to accommodate your preference. 🍽️\n\nSee you at the event! 🎉", options: [] },
      { id: 'declined', name: 'Declined', message: "We'll miss you! 😔\n\nNo worries — we'll share the highlights after the event.\n\nHope to see you next time! 🙏", options: [] },
      { id: 'maybe', name: 'Maybe', message: "No pressure! 😊\n\nWe'll send you a reminder 2 days before.\n\nJust reply *YES* when you decide!\n\n📅 {{event_date}} at {{event_time}}\n📍 {{venue}}", options: [] },
    ],
  },
];

const exampleFlow = chatbotTemplates[0];

// ── WhatsApp Chat Simulator ──
function ChatSimulator({ flow, onClose }) {
  const [messages, setMessages] = useState([]);
  const [currentStepId, setCurrentStepId] = useState(null);
  const [ended, setEnded] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (flow.steps.length > 0) {
      const firstStep = flow.steps[0];
      setCurrentStepId(firstStep.id);
      setMessages([{ type: 'bot', text: firstStep.message, time: getTime() }]);
    }
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  function getTime() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function handleReply(option) {
    const time = getTime();
    setMessages((prev) => [...prev, { type: 'user', text: option.label, time }]);

    if (!option.next) {
      setEnded(true);
      return;
    }

    const nextStep = flow.steps.find((s) => s.id === option.next);
    if (!nextStep) {
      setEnded(true);
      return;
    }

    setTimeout(() => {
      setCurrentStepId(nextStep.id);
      setMessages((prev) => [...prev, { type: 'bot', text: nextStep.message, time: getTime() }]);
      if (nextStep.options.length === 0) setEnded(true);
    }, 600);
  }

  function handleRestart() {
    setMessages([]);
    setEnded(false);
    if (flow.steps.length > 0) {
      const first = flow.steps[0];
      setCurrentStepId(first.id);
      setMessages([{ type: 'bot', text: first.message, time: getTime() }]);
    }
  }

  const currentStep = flow.steps.find((s) => s.id === currentStepId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-900 rounded-3xl p-2 shadow-2xl">
          {/* WhatsApp header */}
          <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3 rounded-t-2xl">
            <button onClick={onClose} className="text-white"><X size={20} /></button>
            <div className="w-9 h-9 rounded-full bg-[var(--color-primary-medium)] flex items-center justify-center text-sm font-bold text-[var(--color-primary-dark)]">
              🤖
            </div>
            <div className="text-white flex-1">
              <p className="font-semibold text-sm">{flow.name}</p>
              <p className="text-xs text-white/70">Chatbot Simulator</p>
            </div>
            <button onClick={handleRestart} className="text-white text-xs bg-white/20 px-2 py-1 rounded">
              Restart
            </button>
          </div>

          {/* Chat messages */}
          <div
            ref={chatRef}
            className="px-3 py-4 overflow-y-auto"
            style={{
              height: '420px',
              backgroundColor: '#e5ddd5',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c8c3ba\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${
                    msg.type === 'user'
                      ? 'bg-[#dcf8c6] rounded-tr-none'
                      : 'bg-white rounded-tl-none'
                  }`}
                >
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-400">{msg.time}</span>
                    {msg.type === 'user' && (
                      <svg width="14" height="10" viewBox="0 0 16 11" className="text-[#4fc3f7]">
                        <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.343-.15.486.486 0 0 0-.343.15l-.546.547a.505.505 0 0 0 0 .689l2.787 2.926c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                        <path fill="currentColor" d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.462.462 1.893 1.986c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Quick reply buttons */}
            {!ended && currentStep && currentStep.options.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 justify-end">
                {currentStep.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleReply(opt)}
                    className="bg-white border border-[#075e54] text-[#075e54] text-sm px-3 py-1.5 rounded-full hover:bg-[#075e54] hover:text-white transition shadow-sm"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {ended && (
              <div className="text-center mt-4">
                <p className="text-xs text-gray-500 bg-white/80 inline-block px-3 py-1 rounded-full">
                  Conversation ended
                </p>
                <button onClick={handleRestart} className="block mx-auto mt-2 text-xs text-[#075e54] underline">
                  Restart conversation
                </button>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 rounded-b-2xl">
            <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-400">
              Select an option above
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step Editor ──
function StepEditor({ step, allSteps, onChange, onDelete, isFirst, onSave }) {
  const [expanded, setExpanded] = useState(false);

  const addOption = () => {
    onChange({
      ...step,
      options: [...step.options, { label: 'New Option', next: '' }],
    });
  };

  const updateOption = (index, field, value) => {
    const opts = [...step.options];
    opts[index] = { ...opts[index], [field]: value };
    onChange({ ...step, options: opts });
  };

  const removeOption = (index) => {
    onChange({ ...step, options: step.options.filter((_, i) => i !== index) });
  };

  return (
    <div className={`bg-white rounded-xl shadow border-l-4 ${isFirst ? 'border-[var(--color-primary)]' : 'border-blue-400'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical size={16} className="text-gray-300" />
        <MessageSquare size={16} className={isFirst ? 'text-[var(--color-primary)]' : 'text-blue-500'} />
        <div className="flex-1">
          <input
            value={step.name}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-sm bg-transparent border-none focus:outline-none focus:ring-0 w-full"
            placeholder="Step name"
          />
        </div>
        {step.notify?.phone && (
          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 mr-1">
            <Send size={10} /> Notify
          </span>
        )}
        <span className="text-xs text-gray-400 mr-2">
          {step.options.length} option{step.options.length !== 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Step ID */}
          <div className="flex items-center gap-2 pt-3">
            <label className="text-xs text-gray-500 w-16">ID:</label>
            <input
              value={step.id}
              onChange={(e) => onChange({ ...step, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              className="text-xs font-mono bg-gray-50 border rounded px-2 py-1 flex-1"
              placeholder="step_id"
            />
            {isFirst && <span className="text-xs bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded">START</span>}
          </div>

          {/* Message */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bot Message:</label>
            <textarea
              value={step.message}
              onChange={(e) => onChange({ ...step, message: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none font-mono"
              placeholder="Message the bot will send..."
            />
          </div>

          {/* Mini preview */}
          <div className="bg-[#e5ddd5] rounded-lg p-3">
            <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[90%] shadow-sm">
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{step.message || '(empty)'}</p>
            </div>
          </div>

          {/* Reply Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Reply Options (user choices):</label>
              <button onClick={addOption} className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] flex items-center gap-1">
                <Plus size={12} /> Add Option
              </button>
            </div>
            {step.options.length === 0 && (
              <p className="text-xs text-gray-400 italic">No options = conversation ends here (terminal step)</p>
            )}
            {step.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  value={opt.label}
                  onChange={(e) => updateOption(i, 'label', e.target.value)}
                  placeholder="Button label"
                  className="flex-1 px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none"
                />
                <ArrowRight size={14} className="text-gray-400 shrink-0" />
                <select
                  value={opt.next}
                  onChange={(e) => updateOption(i, 'next', e.target.value)}
                  className="px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none"
                >
                  <option value="">-- End --</option>
                  {allSteps.filter((s) => s.id !== step.id).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
                <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Notify on this step */}
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={!!step.notify}
                onChange={(e) => onChange({ ...step, notify: e.target.checked ? { phone: '', message: 'New lead from chatbot!\n\nName: {{name}}\nPhone: {{phone}}\nStep: {{step_name}}\nFlow: {{flow_name}}\nUser Reply: {{user_message}}' } : null })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label className="text-xs text-gray-600 font-medium flex items-center gap-1">
                <Send size={12} className="text-indigo-500" /> Notify someone when this step is reached
              </label>
            </div>
            {/* Always show current notify status */}
            {!step.notify && step.options?.length === 0 && (
              <p className="text-[10px] text-gray-400 ml-7 -mt-1 mb-1">No notification set for this terminal step</p>
            )}
            {step.notify && (
              <div className="ml-5 space-y-2 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Notify Phones (comma separated, with country code)</label>
                  <input
                    value={step.notify.phone || ''}
                    onChange={(e) => onChange({ ...step, notify: { ...step.notify, phone: e.target.value } })}
                    placeholder="919876543210, 919123456789"
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                  />
                  <p className="text-[9px] text-gray-400 mt-0.5">Separate multiple numbers with commas</p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">
                    Notification Message
                    <span className="text-indigo-400 ml-1">{'{{name}} {{phone}} {{step_name}} {{flow_name}} {{user_message}}'}</span>
                  </label>
                  <textarea
                    value={step.notify.message || ''}
                    onChange={(e) => onChange({ ...step, notify: { ...step.notify, message: e.target.value } })}
                    rows={3}
                    className="w-full px-2 py-1.5 border rounded text-sm font-mono focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                    placeholder="Notification message..."
                  />
                </div>
                {step.notify.phone && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    <div className="text-[10px] text-green-700">
                      <span className="font-bold">Notify:</span> {step.notify.phone.split(',').map(p => p.trim()).filter(Boolean).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Save button inside step */}
          <div className="border-t pt-3 flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); if (onSave) onSave(); }}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5"
            >
              <Save size={14} /> Save Flow
            </button>
          </div>

          {/* Delete step */}
          {!isFirst && (
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 mt-2"
            >
              <Trash2 size={12} /> Delete this step
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Follow-up Plan Card (inline styles for reliable colors) ──
const PLAN_STYLES = {
  daily:  { border: '#6366f1', bg: '#eef2ff', iconBg: '#e0e7ff', btn: '#4f46e5', btnHover: '#4338ca', emoji: '📅' },
  weekly: { border: '#3b82f6', bg: '#eff6ff', iconBg: '#dbeafe', btn: '#2563eb', btnHover: '#1d4ed8', emoji: '📆' },
  monthly:{ border: '#a855f7', bg: '#faf5ff', iconBg: '#f3e8ff', btn: '#9333ea', btnHover: '#7e22ce', emoji: '🗓️' },
  '3month':{ border: '#f97316', bg: '#fff7ed', iconBg: '#ffedd5', btn: '#ea580c', btnHover: '#c2410c', emoji: '🔄' },
};

function PlanCard({ plan: p, currentPlan, onSelect }) {
  const [days, setDays] = useState(currentPlan?.type === p.type ? currentPlan.days : p.defaultDays);
  const [hover, setHover] = useState(false);
  const isSelected = currentPlan?.type === p.type;
  const totalSends = Math.ceil(days / p.freq);
  const s = PLAN_STYLES[p.type];

  return (
    <div
      style={{
        border: `2px solid ${isSelected ? s.border : '#e5e7eb'}`,
        background: isSelected ? s.bg : (hover ? '#f9fafb' : '#fff'),
        borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isSelected ? s.iconBg : '#f3f4f6', fontSize: 22, flexShrink: 0,
        }}>
          {s.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{p.desc}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'nowrap' }}>Kitne din:</span>
            <input
              type="number" min={p.freq} max={365} value={days}
              onChange={e => setDays(Math.max(p.freq, parseInt(e.target.value) || p.freq))}
              style={{ width: 64, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, textAlign: 'center', outline: 'none' }}
              onClick={e => e.stopPropagation()}
            />
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>= <b>{totalSends}</b> messages/contact</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect({ type: p.type, label: p.label, days, totalSends, freq: p.freq }); }}
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', cursor: 'pointer',
            background: isSelected ? '#16a34a' : s.btn, flexShrink: 0, transition: 'background 0.2s',
          }}
        >
          {isSelected ? '✓ Selected' : 'Select'}
        </button>
      </div>
    </div>
  );
}

// ── Bulk Messages Module (Multi-Campaign) ──
function BulkMessages({ onOpenCampaign }) {
  // Migrate old single-sheet format to campaigns array
  const saved = useRef(null);
  if (!saved.current) {
    try {
      const oldSheet = JSON.parse(localStorage.getItem('bulk_sheet') || 'null');
      const savedCampaigns = JSON.parse(localStorage.getItem('bulk_campaigns') || 'null');
      if (savedCampaigns) {
        saved.current = savedCampaigns;
      } else if (oldSheet && oldSheet.contacts?.length > 0) {
        // Migrate old format
        saved.current = [{ id: Date.now(), name: 'Sheet 1', contacts: oldSheet.contacts, columns: oldSheet.columns || [], message: oldSheet.message || '', isActive: oldSheet.isActive || false, batchId: oldSheet.batchId || null, selectedFlowId: oldSheet.selectedFlowId || '', plan: oldSheet.plan || null }];
        localStorage.removeItem('bulk_sheet');
      } else {
        saved.current = [];
      }
    } catch { saved.current = []; }
  }

  const [campaigns, setCampaigns] = useState(saved.current);
  const [activeIdx, setActiveIdx] = useState(0);
  const [allFlows, setAllFlows] = useState([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [bulkImages, setBulkImages] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [savedCampaigns, setSavedCampaigns] = useState([]);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [warmupDay, setWarmupDay] = useState(() => { try { return parseInt(localStorage.getItem('bulk_warmup_day') || '1'); } catch { return 1; } });
  const [warmupSent, setWarmupSent] = useState(() => { try { return parseInt(localStorage.getItem('bulk_warmup_sent') || '0'); } catch { return 0; } });
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [limitPopupData, setLimitPopupData] = useState(null);
  const fileRef = useRef(null);
  const msgRef = useRef(null);
  const bulkImgRef = useRef(null);
  const pollRefs = useRef({}); // { campaignId: intervalId }

  const c = campaigns[activeIdx] || null; // active campaign shorthand

  // Helper to update active campaign
  function updateC(updates) {
    setCampaigns(prev => prev.map((camp, i) => i === activeIdx ? { ...camp, ...updates } : camp));
  }

  // Fetch all saved chatbot flows + saved campaigns from Campaign Builder
  const refreshPipelines = useCallback(() => {
    api.get('/campaigns').then(res => setSavedCampaigns(res.data.campaigns || [])).catch(err => console.error('Failed to load campaigns:', err.message));
  }, []);

  useEffect(() => {
    api.get('/chatbot/flows').then(res => setAllFlows(res.data.flows || [])).catch(err => console.error('Failed to load flows:', err.message));
    refreshPipelines();

    // Re-fetch contacts for pipeline campaigns restored from localStorage (they don't store contacts to save space)
    campaigns.forEach((camp, idx) => {
      if (camp.campaignDbId && (!camp.contacts || camp.contacts.length === 0)) {
        api.get(`/campaigns/${camp.campaignDbId}/contacts`).then(res => {
          const contacts = (res.data.contacts || []).map(c => ({
            phone: c.phone,
            name: c.contact_data?.fullname || c.contact_data?.name || '',
            ...c.contact_data,
          }));
          const columns = contacts.length > 0 ? Object.keys(contacts[0]).filter(k => k !== 'phone') : [];
          setCampaigns(prev => prev.map((p, i) => i === idx ? { ...p, contacts, columns: ['phone', ...columns] } : p));
        }).catch(err => console.error(`Failed to reload contacts for ${camp.name}:`, err.message));
      }
    });
  }, []);

  // Re-fetch pipelines periodically and on window focus
  useEffect(() => {
    const onFocus = () => refreshPipelines();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(refreshPipelines, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(interval); };
  }, [refreshPipelines]);

  // Add a Campaign Builder pipeline as a Bulk tab with auto-config
  async function addCampaignAsTab(camp) {
    try {
      // Fetch contacts and campaign details (steps) in parallel
      const [contRes, campRes] = await Promise.all([
        api.get(`/campaigns/${camp.id}/contacts`),
        api.get(`/campaigns/${camp.id}`),
      ]);
      const contacts = (contRes.data.contacts || []).map(c => ({
        phone: c.phone,
        name: c.contact_data?.fullname || c.contact_data?.name || '',
        ...c.contact_data,
      }));
      if (contacts.length === 0) { toast.error('No contacts in this campaign'); return; }
      const columns = contacts.length > 0 ? Object.keys(contacts[0]).filter(k => k !== 'phone') : [];

      // Auto-detect flow and message from campaign steps
      const steps = campRes.data.steps || [];
      let autoFlowId = '';
      let autoMessage = '';
      let autoFlow = null;
      let autoUseFlow = false;
      let autoVarMapping = {};

      // Find first message step for default message
      const msgStep = steps.find(s => s.step_type === 'message' && s.message_text);
      if (msgStep) autoMessage = msgStep.message_text;

      // Find first chatbot step for auto-flow selection
      const flowStep = steps.find(s => s.step_type === 'chatbot' && s.flow_id);
      if (flowStep) {
        autoFlowId = String(flowStep.flow_id);
        try {
          const flowRes = await api.get(`/chatbot/flows/${flowStep.flow_id}`);
          const f = flowRes.data;
          if (f && f.steps) {
            f.stepCount = f.steps.length;
            f.firstMessage = f.steps[0]?.message || '';
            const flowVars = [];
            for (const step of f.steps) {
              for (const m of (step.message || '').matchAll(/\{\{(\w+)\}\}/g)) flowVars.push(m[1]);
            }
            f.flowVars = [...new Set(flowVars)];
            autoFlow = f;
            autoUseFlow = true;
            // Auto-map flow vars to CSV columns
            const cols = ['phone', ...columns];
            for (const fv of f.flowVars) {
              const match = cols.find(col => col.toLowerCase() === fv.toLowerCase());
              if (match) autoVarMapping[fv] = match;
            }
          }
        } catch {}
      }

      const newCampaign = {
        id: Date.now(), campaignDbId: camp.id, name: `📋 ${camp.name}`,
        contacts, columns: ['phone', ...columns],
        message: autoMessage, isActive: false, sending: false, paused: false,
        batchId: null, batchStatus: null, statusMap: {},
        useFlow: autoUseFlow, activeFlow: autoFlow, selectedFlowId: autoFlowId,
        plan: null, varMapping: autoVarMapping,
      };
      setCampaigns(prev => {
        setActiveIdx(prev.length);
        return [...prev, newCampaign];
      });
      setShowCampaignPicker(false);
      const parts = [`"${camp.name}" — ${contacts.length} contacts loaded`];
      if (autoFlow) parts.push(`Flow: ${autoFlow.name}`);
      if (autoMessage) parts.push(`Message set`);
      toast.success(parts.join(' | '));
    } catch (err) {
      toast.error('Failed to load campaign contacts');
    }
  }

  // Save campaigns to localStorage (pipeline campaigns store only metadata, contacts re-fetched on load)
  useEffect(() => {
    if (campaigns.length > 0) {
      const toSave = campaigns.map(camp => ({
        id: camp.id, campaignDbId: camp.campaignDbId || null, name: camp.name,
        contacts: camp.campaignDbId ? [] : (camp.contacts || []), columns: camp.columns,
        message: camp.message, isActive: camp.isActive, batchId: camp.batchId, selectedFlowId: camp.selectedFlowId, plan: camp.plan,
      }));
      try { localStorage.setItem('bulk_campaigns', JSON.stringify(toSave)); } catch {}
    } else {
      localStorage.removeItem('bulk_campaigns');
    }
  }, [campaigns]);

  // Resume polling for campaigns with batchIds — watches for new batchIds
  useEffect(() => {
    campaigns.forEach((camp) => {
      if (camp.batchId && !pollRefs.current[camp.id]) startPolling(camp.batchId, camp.id);
    });
    return () => { Object.values(pollRefs.current).forEach(clearInterval); pollRefs.current = {}; };
  }, [campaigns.map(c => c.batchId).join(',')]);

  // Parse a CSV line respecting quoted fields
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    result.push(current.trim());
    return result;
  }

  function parseCSV(text, filename = 'Sheet') {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV must have header row + at least 1 data row'); return; }

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
    const phoneIdx = headers.findIndex(h => /phone|mobile|number|whatsapp/i.test(h));
    if (phoneIdx === -1) { toast.error('No phone/mobile/number column found in CSV'); return; }

    const nameIdx = headers.findIndex(h => /^name$|^fullname$/i.test(h));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (!vals[phoneIdx]) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h.toLowerCase().replace(/\s+/g, '_')] = vals[idx] || ''; });
      row.phone = String(vals[phoneIdx]).replace(/[^0-9]/g, '');
      if (!row.name && nameIdx !== -1) row.name = vals[nameIdx] || '';
      if (!row.name && row.fullname) row.name = row.fullname;
      if (row.phone) rows.push(row);
    }

    const newCampaign = {
      id: Date.now(), name: filename.replace(/\.(csv|txt)$/i, ''),
      contacts: rows, columns: headers.map(h => h.toLowerCase().replace(/\s+/g, '_')),
      message: '', isActive: false, sending: false, paused: false,
      batchId: null, batchStatus: null, statusMap: {},
      useFlow: false, activeFlow: null, selectedFlowId: '', plan: null, varMapping: {},
    };
    setCampaigns(prev => {
      setActiveIdx(prev.length);
      return [...prev, newCampaign];
    });
    toast.success(`"${newCampaign.name}" — ${rows.length} contacts loaded`);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (text) parseCSV(text, `Pasted ${campaigns.length + 1}`);
  }

  function removeCampaign(idx) {
    const camp = campaigns[idx];
    if (camp.sending && !confirm('This campaign is currently sending. Remove it?')) return;
    if (pollRefs.current[camp.id]) { clearInterval(pollRefs.current[camp.id]); delete pollRefs.current[camp.id]; }
    setCampaigns(prev => prev.filter((_, i) => i !== idx));
    if (activeIdx >= idx && activeIdx > 0) setActiveIdx(activeIdx - 1);
  }

  // Extract all {{variables}} from flow steps
  function extractFlowVars(flow) {
    const vars = new Set();
    if (!flow?.steps) return [];
    for (const step of flow.steps) {
      const matches = (step.message || '').matchAll(/\{\{(\w+)\}\}/g);
      for (const m of matches) vars.add(m[1]);
    }
    return [...vars];
  }

  // Handle flow selection for active campaign
  function handleFlowSelect(flowId) {
    if (!flowId) {
      updateC({ activeFlow: null, useFlow: false, selectedFlowId: '', varMapping: {} });
      return;
    }
    // Set selectedFlowId immediately so dropdown stays in sync
    updateC({ selectedFlowId: flowId });
    api.get(`/chatbot/flows/${flowId}`)
      .then(res => {
        const f = res.data;
        if (f && f.steps) {
          f.stepCount = f.steps.length;
          f.firstMessage = f.steps[0]?.message || '';
          const flowVars = extractFlowVars(f);
          f.flowVars = flowVars;
          const autoMap = {};
          const cols = campaigns[activeIdx]?.columns || [];
          for (const fv of flowVars) {
            const exactMatch = cols.find(col => col.toLowerCase() === fv.toLowerCase());
            if (exactMatch) autoMap[fv] = exactMatch;
          }
          // Use functional update — also check flowId still matches to avoid race condition
          setCampaigns(prev => prev.map((camp, i) => i === activeIdx && camp.selectedFlowId === flowId
            ? { ...camp, activeFlow: f, useFlow: true, selectedFlowId: flowId, varMapping: autoMap }
            : camp
          ));
        }
      })
      .catch(() => { updateC({ selectedFlowId: '' }); });
  }

  async function handleActivate() {
    if (!c || c.contacts.length === 0) { toast.error('Please upload a CSV first!'); return; }
    try {
      const phones = c.contacts.map(ct => ct.phone).filter(Boolean);
      await api.post('/chatbot/sheet-activate', { phones });
      updateC({ isActive: true });
      toast.success(`Sheet activated! Bot will reply to ${phones.length} numbers only.`);
    } catch (err) {
      toast.error('Activate failed: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleDeactivate() {
    try { await api.post('/chatbot/sheet-deactivate'); } catch (err) { console.error('Deactivate failed:', err.message); }
    updateC({ isActive: false, sending: false, paused: false });
    toast('Sheet deactivated.');
  }

  async function handlePause() {
    try { await api.post('/chatbot/bulk-pause'); updateC({ paused: true }); toast('Sending paused.'); } catch { toast.error('Pause failed'); }
  }

  async function handleResume() {
    try { await api.post('/chatbot/bulk-resume'); updateC({ paused: false }); toast.success('Sending resumed!'); } catch { toast.error('Resume failed'); }
  }

  async function handleCancel() {
    if (!c || !confirm('Cancel all queued messages?')) return;
    try {
      await api.post('/chatbot/bulk-cancel', { batch_id: c.batchId });
      updateC({ sending: false, paused: false });
      toast('All queued messages cancelled.');
      if (c.batchId) startPolling(c.batchId, c.id);
    } catch { toast.error('Cancel failed'); }
  }

  async function handleBulkImageUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBulkUploading(true);
    for (const file of files) {
      const form = new FormData();
      form.append('image', file);
      try {
        const res = await api.post('/messages/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        setBulkImages(prev => [...prev, { url: res.data.url, filename: res.data.filename, preview: res.data.url }]);
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setBulkUploading(false);
    e.target.value = '';
  }

  async function removeBulkImage(idx) {
    const img = bulkImages[idx];
    try { await api.delete(`/messages/upload-image/${img.filename}`); } catch {}
    setBulkImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleStartSending() {
    if (!c) return;
    if (!c.isActive) { toast.error('Please activate the sheet first!'); return; }
    const sendingMessage = c.useFlow ? c.activeFlow?.firstMessage : c.message;
    if (!c.useFlow && !c.message.trim()) { toast.error('Please write a message first!'); msgRef.current?.focus(); return; }
    if (c.useFlow && !c.activeFlow) { toast.error('Koi chatbot flow select nahi hai!'); return; }

    updateC({ sending: true });
    try {
      const minimalContacts = c.contacts.map(ct => {
        const obj = { phone: ct.phone };
        // Include ALL columns so notify messages can use any variable
        for (const col of c.columns) { obj[col] = ct[col] || ''; }
        // Apply variable mapping: flow_var -> sheet_column
        if (c.useFlow && c.varMapping) {
          for (const [flowVar, sheetCol] of Object.entries(c.varMapping)) {
            if (sheetCol && ct[sheetCol] !== undefined) obj[flowVar] = ct[sheetCol] || '';
          }
        }
        if (!obj.name && ct.name) obj.name = ct.name;
        if (!obj.name && ct.fullname) obj.name = ct.fullname;
        return obj;
      });

      // Warm-up: slice contacts to remaining day limit
      const warmupLimit = getWarmupLimit(warmupDay);
      let contactsToSend = minimalContacts;
      if (warmupLimit !== Infinity) {
        const remaining = Math.max(0, warmupLimit - warmupSent);
        if (remaining === 0) {
          setLimitPopupData({ day: warmupDay, limit: warmupLimit, sent: warmupSent, remaining: minimalContacts.length });
          setShowLimitPopup(true);
          updateC({ sending: false });
          return;
        }
        contactsToSend = minimalContacts.slice(0, remaining);
      }

      const payload = { contacts: contactsToSend };
      if (c.useFlow && c.activeFlow) { payload.use_flow = true; payload.flow_id = c.activeFlow.id; }
      else { payload.message = c.message; }
      if (bulkImages.length > 0) {
        payload.media = bulkImages.map(img => ({ url: img.url, filename: img.filename, caption: '' }));
      }
      if (c.plan) payload.plan = c.plan;

      const res = await api.post('/chatbot/bulk-send', payload);
      updateC({ batchId: res.data.batch_id });

      // Update warm-up sent count
      const newSent = warmupSent + contactsToSend.length;
      setWarmupSent(newSent);
      localStorage.setItem('bulk_warmup_sent', String(newSent));

      toast.success(`${res.data.queued} queued, ${res.data.failed} failed, ${res.data.skipped} skipped`);
      startPolling(res.data.batch_id, c.id);

      // Show limit popup if more contacts remain
      if (contactsToSend.length < minimalContacts.length) {
        const leftOver = minimalContacts.length - contactsToSend.length;
        setLimitPopupData({ day: warmupDay, limit: warmupLimit, sent: newSent, remaining: leftOver });
        setShowLimitPopup(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
      updateC({ sending: false });
    }
  }

  function startPolling(bid, campaignId) {
    if (pollRefs.current[campaignId]) clearInterval(pollRefs.current[campaignId]);
    let errorCount = 0;
    pollRefs.current[campaignId] = setInterval(async () => {
      try {
        const res = await api.get(`/chatbot/bulk-status/${bid}`);
        errorCount = 0;
        const map = {};
        for (const msg of res.data.messages) {
          map[msg.phone] = { status: msg.status, error: msg.error_message, sentAt: msg.sent_at };
        }
        setCampaigns(prev => prev.map(camp => camp.id === campaignId ? { ...camp, batchStatus: res.data.summary, statusMap: map } : camp));
        if (res.data.summary.queued === 0) {
          clearInterval(pollRefs.current[campaignId]);
          delete pollRefs.current[campaignId];
          setCampaigns(prev => prev.map(camp => camp.id === campaignId ? { ...camp, sending: false } : camp));
        }
      } catch (err) {
        errorCount++;
        if (errorCount >= 5) {
          clearInterval(pollRefs.current[campaignId]);
          delete pollRefs.current[campaignId];
          setCampaigns(prev => prev.map(camp => camp.id === campaignId ? { ...camp, sending: false } : camp));
          toast.error('Status polling failed — please refresh to check status');
        }
      }
    }, 2000);
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'sent': return <CheckCircle size={14} className="text-[var(--color-primary)]" />;
      case 'failed': return <XCircle size={14} className="text-red-500" />;
      case 'queued': return <Clock size={14} className="text-yellow-500 animate-pulse" />;
      case 'cancelled': return <X size={14} className="text-gray-400" />;
      default: return <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />;
    }
  }

  function getStatusBadge(status) {
    const styles = { sent: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]', failed: 'bg-red-100 text-red-700', queued: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-gray-100 text-gray-500' };
    return styles[status] || 'bg-gray-100 text-gray-500';
  }

  function normPhone(p) {
    let d = String(p || '').replace(/[^0-9]/g, '');
    if (d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) d = '91' + d;
    else if (d.length > 0 && !d.startsWith('91')) d = '91' + d;
    return d;
  }

  const availableVars = c ? c.columns.filter(col => col !== 'phone') : [];

  // ── Campaign color palette for tabs ──
  const CAMPAIGN_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Close campaign picker when clicking outside
  useEffect(() => {
    if (!showCampaignPicker) return;
    const close = () => setShowCampaignPicker(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [showCampaignPicker]);

  return (
    <div className="space-y-4">

      {/* ── Campaign Tabs Bar ── */}
      <div className="bg-white rounded-xl shadow p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-sm">Campaigns</h3>
          <span className="text-xs text-gray-400">({campaigns.length} sheets)</span>
          <div className="flex-1" />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium">
            <Plus size={14} /> Add CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
        </div>

        {campaigns.length === 0 ? (
          <div
            onPaste={handlePaste} tabIndex={0}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition focus:outline-none focus:border-indigo-500"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">Click to upload CSV or paste data here</p>
            <p className="text-gray-400 text-xs mt-2">Upload multiple CSV files — each will create a separate campaign</p>
            <p className="text-gray-400 text-xs mt-3 font-mono">Example: name, phone, city</p>
            <p className="text-gray-400 text-xs font-mono">Rahul, 919876543210, Mumbai</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1" onPaste={handlePaste} tabIndex={0}>
            {campaigns.map((camp, i) => {
              const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
              const isActive = i === activeIdx;
              const sentCount = camp.batchStatus?.sent || 0;
              const totalCount = camp.contacts.length;
              return (
                <div
                  key={camp.id}
                  onClick={() => setActiveIdx(i)}
                  style={{ borderColor: isActive ? color : 'transparent', borderWidth: 2, borderStyle: 'solid', background: isActive ? color + '0D' : '#f9fafb' }}
                  className="relative flex-shrink-0 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 transition min-w-[160px] max-w-[220px] group"
                >
                  <button onClick={(e) => { e.stopPropagation(); removeCampaign(i); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow text-xs"
                  ><X size={10} /></button>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <p className="font-medium text-xs truncate">{camp.name}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500">{totalCount} contacts</span>
                    {camp.sending && <span className="text-[10px] text-yellow-600 font-medium animate-pulse">Sending...</span>}
                    {!camp.sending && sentCount > 0 && <span className="text-[10px] text-[var(--color-primary)] font-medium">{sentCount}/{totalCount} sent</span>}
                    {camp.plan && <span className="text-[10px]">{PLAN_STYLES[camp.plan.type]?.emoji || '📅'}</span>}
                  </div>
                </div>
              );
            })}
            {/* Quick add CSV button */}
            <div
              onClick={() => fileRef.current?.click()}
              className="flex-shrink-0 rounded-lg px-4 py-2 cursor-pointer border-2 border-dashed border-gray-300 hover:border-indigo-400 transition flex items-center gap-2 text-gray-400 hover:text-indigo-600 min-w-[80px] justify-center"
            >
              <Plus size={14} /> <span className="text-xs">CSV</span>
            </div>
            {/* Add Campaign Builder pipeline */}
            {savedCampaigns.length > 0 && (
              <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                <div
                  onClick={() => setShowCampaignPicker(!showCampaignPicker)}
                  className="rounded-lg px-3 py-2 cursor-pointer border-2 border-dashed border-green-300 hover:border-green-500 transition flex items-center gap-1.5 text-green-500 hover:text-green-700"
                >
                  <Megaphone size={12} /> <span className="text-xs">Pipeline</span>
                </div>
                {showCampaignPicker && (
                  <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border z-[100] w-64 max-h-60 overflow-auto">
                    <div className="px-3 py-2 border-b bg-gray-50 rounded-t-lg">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Select Pipeline</p>
                    </div>
                    {savedCampaigns.map(sc => (
                      <div
                        key={sc.id}
                        onClick={() => addCampaignAsTab(sc)}
                        className="px-3 py-2.5 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition"
                      >
                        <p className="text-xs font-medium truncate">{sc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            sc.status === 'active' ? 'bg-green-100 text-green-700' :
                            sc.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{sc.status}</span>
                          <span className="text-[10px] text-gray-400">{sc.contact_count || 0} contacts</span>
                          <span className="text-[10px] text-gray-400">{sc.step_count || 0} steps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Saved Campaigns from Campaign Builder ── */}
      {savedCampaigns.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Megaphone size={16} className="text-indigo-600" />
              Your Pipelines
              <span className="text-xs text-gray-400">({savedCampaigns.length})</span>
            </h3>
            <p className="text-[10px] text-gray-400">Click "Add to Bulk" to load contacts as a tab above</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedCampaigns.map(camp => {
              const statusStyle = {
                draft: { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: '📝' },
                active: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', icon: '🟢' },
                paused: { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: '⏸️' },
                completed: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '✅' },
              }[camp.status] || { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: '📋' };
              const alreadyAdded = campaigns.some(c => c.name === `📋 ${camp.name}`);
              return (
                <div key={camp.id} className={`rounded-xl border p-4 ${statusStyle.bg} transition`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{statusStyle.icon}</span>
                        <p className="font-semibold text-sm truncate">{camp.name}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.badge}`}>{camp.status}</span>
                        <span className="text-[10px] text-gray-500">{camp.contact_count || 0} contacts</span>
                        <span className="text-[10px] text-gray-500">{camp.step_count || 0} steps</span>
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[10px]">
                        {camp.active_contacts > 0 && <span className="text-green-600">{camp.active_contacts} active</span>}
                        {camp.completed_contacts > 0 && <span className="text-blue-600">{camp.completed_contacts} done</span>}
                        {camp.stopped_contacts > 0 && <span className="text-red-500">{camp.stopped_contacts} stopped</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => addCampaignAsTab(camp)}
                        disabled={alreadyAdded}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          alreadyAdded
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Plus size={12} /> {alreadyAdded ? 'Added' : 'Add to Bulk'}
                      </button>
                      <button
                        onClick={() => onOpenCampaign?.(camp.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        <Eye size={12} /> Manage
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Campaign Detail ── */}
      {c && (<>

      {/* Chatbot Flow Selector + Message Config */}
      {!c.sending && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare size={14} className="text-[var(--color-primary)]" />
              Chatbot Flow / Message — <span className="text-indigo-600">{c.name}</span>
            </h3>
          </div>

          {/* Flow dropdown */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <select
                value={c.selectedFlowId}
                onChange={e => handleFlowSelect(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
              >
                <option value="">-- Custom Message (No Flow) --</option>
                {allFlows.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
              {c.useFlow && (
                <button onClick={() => updateC({ useFlow: false, selectedFlowId: '', activeFlow: null })}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition whitespace-nowrap">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Variable tags - always visible, draggable */}
          {availableVars.length > 0 && (
            <div className="mb-2">
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                {availableVars.map(v => (
                  <button key={v}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', v); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => { if (!c.useFlow) updateC({ message: (c.message || '') + `{{${v}}}` }); }}
                    className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs font-mono hover:bg-indigo-100 transition shrink-0 cursor-grab active:cursor-grabbing select-none">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {c.useFlow && c.activeFlow ? (
            <div className="space-y-3">
              {/* Flow Info */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12 }}>
                <div className="flex items-start gap-2">
                  <MessageSquare size={16} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-[var(--color-primary-dark)] text-sm">{c.activeFlow.name} ({c.activeFlow.stepCount} steps)</p>
                    <p className="text-xs text-[var(--color-primary)] mt-1">First message will be sent to all, bot will auto-reply on responses</p>
                    <div className="mt-2 bg-white rounded-lg p-2.5 border border-[var(--color-primary-light)] max-h-32 overflow-y-auto">
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{c.activeFlow.firstMessage}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variable Mapping UI */}
              {c.activeFlow.flowVars?.length > 0 && (
                <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 12 }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 size={14} className="text-indigo-600" />
                    <p className="text-sm font-semibold text-indigo-800">Variable Mapping</p>
                    <p className="text-[10px] text-indigo-400 ml-auto">Sheet column → Flow variable</p>
                  </div>

                  <div className="space-y-2">
                    {c.activeFlow.flowVars.map(flowVar => {
                      const mapped = c.varMapping?.[flowVar];
                      return (
                        <div key={flowVar} className="flex items-center gap-2">
                          {/* Flow variable (target) */}
                          <div
                            className={`flex-1 px-3 py-2 rounded-lg border-2 border-dashed text-xs font-mono flex items-center justify-between transition-all ${
                              mapped
                                ? 'bg-green-50 border-green-300 text-green-700'
                                : 'bg-white border-indigo-200 text-indigo-400'
                            }`}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50'); }}
                            onDragLeave={e => { e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50'); }}
                            onDrop={e => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                              const sheetCol = e.dataTransfer.getData('text/plain');
                              if (sheetCol) updateC({ varMapping: { ...(c.varMapping || {}), [flowVar]: sheetCol } });
                            }}
                          >
                            <span>{`{{${flowVar}}}`}</span>
                            {mapped ? (
                              <span className="flex items-center gap-1">
                                <ArrowRight size={10} className="text-green-500" />
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{`{{${mapped}}}`}</span>
                                <button
                                  onClick={() => {
                                    const newMap = { ...(c.varMapping || {}) };
                                    delete newMap[flowVar];
                                    updateC({ varMapping: newMap });
                                  }}
                                  className="ml-1 text-red-400 hover:text-red-600"
                                >
                                  <Unlink size={12} />
                                </button>
                              </span>
                            ) : (
                              <span className="text-[10px] text-indigo-300 italic">Drop sheet column here</span>
                            )}
                          </div>

                          {/* Dropdown fallback */}
                          <select
                            value={mapped || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val) updateC({ varMapping: { ...(c.varMapping || {}), [flowVar]: val } });
                              else {
                                const newMap = { ...(c.varMapping || {}) };
                                delete newMap[flowVar];
                                updateC({ varMapping: newMap });
                              }
                            }}
                            className="w-32 px-2 py-1.5 text-xs border rounded-lg bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                          >
                            <option value="">-- select --</option>
                            {availableVars.map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-indigo-400 mt-2">
                    Drag sheet columns to flow variables, or select from dropdown
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <textarea ref={msgRef} value={c.message} onChange={(e) => updateC({ message: e.target.value })}
                rows={3} disabled={c.sending}
                placeholder="Type your message... Use {{fullname}}, {{mobile}} etc."
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono disabled:bg-gray-50 ${c.isActive && !c.useFlow && !c.message?.trim() ? 'border-red-300 bg-red-50/30' : ''}`}
              />
              {c.isActive && !c.useFlow && !c.message?.trim() && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Write a message or select a chatbot flow
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Image Attachments */}
      {!c.sending && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ImagePlus size={16} className="text-indigo-500" />
              <h3 className="font-semibold text-sm">Attachments</h3>
              {bulkImages.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {bulkImages.length} image{bulkImages.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => bulkImgRef.current?.click()}
              disabled={bulkUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium disabled:opacity-50"
            >
              <ImagePlus size={12} />
              {bulkUploading ? 'Uploading...' : 'Add Images'}
            </button>
            <input ref={bulkImgRef} type="file" accept="image/*" multiple onChange={handleBulkImageUpload} className="hidden" />
          </div>
          {bulkImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {bulkImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                  <button onClick={() => removeBulkImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {bulkImages.length === 0 && (
            <p className="text-xs text-gray-400">Images will be sent with each message to all contacts</p>
          )}
        </div>
      )}

      {/* Follow-up Plan Section */}
      {!c.sending && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-sm">Follow-up Plan — <span className="text-indigo-600">{c.name}</span></h3>
            </div>
            {c.plan && (
              <button onClick={() => updateC({ plan: null })} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={12} /> Remove Plan
              </button>
            )}
          </div>

          {c.plan ? (
            <div style={{ background: PLAN_STYLES[c.plan.type]?.bg || '#eef2ff', border: `1px solid ${PLAN_STYLES[c.plan.type]?.border || '#6366f1'}33`, borderRadius: 10, padding: 14 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PLAN_STYLES[c.plan.type]?.iconBg || '#e0e7ff', fontSize: 20 }}>
                    {PLAN_STYLES[c.plan.type]?.emoji || '📅'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: PLAN_STYLES[c.plan.type]?.btn || '#4f46e5' }}>{c.plan.label}</p>
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      {c.plan.days} days — every {c.plan.type === 'daily' ? 'day' : c.plan.type === 'weekly' ? 'week' : c.plan.type === 'monthly' ? 'month' : '3 months'} — <b>{c.plan.totalSends} messages</b> per contact
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPlanModal(true)} style={{ background: PLAN_STYLES[c.plan.type]?.iconBg || '#e0e7ff', color: PLAN_STYLES[c.plan.type]?.btn || '#4f46e5', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Settings2 size={12} /> Change
                </button>
              </div>
              {/* Schedule preview */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${PLAN_STYLES[c.plan.type]?.border || '#6366f1'}22` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: PLAN_STYLES[c.plan.type]?.btn || '#4f46e5', marginBottom: 6 }}>Schedule Preview:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(c.plan.totalSends, 10) }, (_, i) => {
                    const dayOffset = i * c.plan.freq;
                    const date = new Date();
                    date.setDate(date.getDate() + dayOffset);
                    return (
                      <span key={i} style={{ background: '#fff', color: PLAN_STYLES[c.plan.type]?.btn || '#4f46e5', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>
                        {i === 0 ? 'Today' : `Day ${dayOffset + 1}`}: {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    );
                  })}
                  {c.plan.totalSends > 10 && (
                    <span style={{ fontSize: 10, color: '#9ca3af', padding: '2px 8px' }}>...+{c.plan.totalSends - 10} more</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPlanModal(true)}
              className="w-full border-2 border-dashed border-indigo-300 rounded-lg p-4 text-center hover:border-indigo-500 hover:bg-indigo-50/50 transition">
              <Calendar size={24} className="mx-auto text-indigo-300 mb-2" />
              <p className="text-sm text-indigo-600 font-medium">Set Follow-up Plan</p>
              <p className="text-xs text-gray-400 mt-1">Choose Daily, Weekly, Monthly or 3 Month plan</p>
            </button>
          )}
        </div>
      )}

      {/* Follow-up Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowPlanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 rounded-t-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Calendar size={20} />
                  <h2 className="text-lg font-bold">Follow-up Plan — {c.name}</h2>
                </div>
                <button onClick={() => setShowPlanModal(false)} className="text-white/70 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              <p className="text-indigo-200 text-xs mt-1">Set how many days to send messages to contacts</p>
            </div>
            <div className="p-5 space-y-3">
              {[
                { type: 'daily', label: 'Daily Plan', desc: 'Message sent every day', defaultDays: 7, freq: 1 },
                { type: 'weekly', label: 'Weekly Plan', desc: 'One message every week', defaultDays: 28, freq: 7 },
                { type: 'monthly', label: 'Monthly Plan', desc: 'One message every month', defaultDays: 90, freq: 30 },
                { type: '3month', label: '3 Month Plan', desc: 'One message every 3 months', defaultDays: 180, freq: 90 },
              ].map(p => (
                <PlanCard key={p.type} plan={p} currentPlan={c.plan} onSelect={(selected) => {
                  updateC({ plan: selected });
                  setShowPlanModal(false);
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Warm-up Plan Selector */}
      {c && c.contacts.length > 0 && (
        <WarmUpSelector
          storageKey="bulk_warmup"
          onDayChange={({ day, sent }) => { setWarmupDay(day); setWarmupSent(sent); }}
        />
      )}

      {/* Action Bar + Batch Status */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <p className="text-sm text-gray-600 font-medium">{c.contacts.length} recipients</p>
            {c.batchStatus && (
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle size={10} /> {c.batchStatus.sent} sent
                </span>
                {c.batchStatus.queued > 0 && (
                  <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                    <Clock size={10} /> {c.batchStatus.queued} pending
                  </span>
                )}
                {c.batchStatus.failed > 0 && (
                  <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    <XCircle size={10} /> {c.batchStatus.failed} failed
                  </span>
                )}
              </div>
            )}
            {c.sending && c.paused && (
              <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                <Clock size={10} /> Paused
              </span>
            )}
            {c.sending && !c.paused && !c.batchStatus && (
              <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium animate-pulse">
                <RefreshCw size={10} className="animate-spin" /> Starting...
              </span>
            )}
            {c.useFlow && c.activeFlow && c.sending && (
              <span className="text-xs text-[var(--color-primary)] font-medium">Flow: {c.activeFlow.name}</span>
            )}
            {c.plan && (
              <span className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                <Calendar size={10} /> {c.plan.label} ({c.plan.totalSends} sends)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {!c.isActive ? (
              <button onClick={handleActivate}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition text-sm font-medium">
                <Play size={14} /> Activate Sheet
              </button>
            ) : !c.sending ? (
              <>
                <button onClick={handleDeactivate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-xs">
                  <X size={14} /> Deactivate
                </button>
                <button onClick={handleStartSending}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg transition text-sm font-medium ${(c.useFlow && c.activeFlow) || c.message?.trim() ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]' : 'bg-[var(--color-primary-medium)] text-white cursor-not-allowed'}`}>
                  <Send size={14} /> {c.useFlow ? 'Start Flow' : 'Start Sending'}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                {!c.paused ? (
                  <button onClick={handlePause}
                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-sm font-medium">
                    <Clock size={14} /> Pause
                  </button>
                ) : (
                  <button onClick={handleResume}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)] transition text-sm font-medium animate-pulse">
                    <Play size={14} /> Resume
                  </button>
                )}
                <button onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium">
                  <X size={14} /> Cancel All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contacts Sheet with live status */}
      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700">
            <FileSpreadsheet size={14} className="text-indigo-500" />
            {c.name} — {c.contacts.length} rows
          </h3>
          <div className="flex gap-2 items-center">
            <button onClick={() => { if (c.batchId) startPolling(c.batchId, c.id); else toast('Sheet data already loaded'); }} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[400px] md:max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b">
                <th className="px-2 md:px-3 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
                {c.columns.map(col => (
                  <th key={col} className="px-2 md:px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{col}</th>
                ))}
                <th className="px-2 md:px-3 py-2 text-left text-xs font-semibold text-gray-500 w-28 whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {c.contacts.map((contact, i) => {
                const np = normPhone(contact.phone);
                const st = (c.statusMap || {})[np] || (c.statusMap || {})[contact.phone];
                const status = st?.status || 'pending';
                return (
                  <tr key={i} className={`border-b hover:bg-blue-50/50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${status === 'sent' ? '!bg-[var(--color-primary-light)]' : status === 'failed' ? '!bg-red-50' : ''}`}>
                    <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                    {c.columns.map(col => (
                      <td key={col} className="px-3 py-1.5 text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate">{contact[col] || ''}</td>
                    ))}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(status)}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(status)}`}>{status}</span>
                      </div>
                      {st?.error && <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[200px]" title={st.error}>{st.error}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {/* Warm-up Limit Reached Popup */}
      {showLimitPopup && limitPopupData && (
        <WarmUpLimitPopup
          currentDay={limitPopupData.day}
          limit={limitPopupData.limit}
          sent={limitPopupData.sent}
          remaining={limitPopupData.remaining}
          onStop={() => { setShowLimitPopup(false); setLimitPopupData(null); }}
          onSwitch={(nextDay) => {
            setWarmupDay(nextDay);
            setWarmupSent(0);
            localStorage.setItem('bulk_warmup_day', String(nextDay));
            localStorage.setItem('bulk_warmup_sent', '0');
            setShowLimitPopup(false);
            setLimitPopupData(null);
            toast.success(`Switched to Day ${nextDay <= 7 ? nextDay : '8+'}! Limit: ${nextDay <= 7 ? WARMUP_LIMITS[nextDay - 1] : 'Unlimited'} messages`);
          }}
        />
      )}

    </div>
  );
}

// ── Quick Send (Single User) ──
function Conversations() {
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contactName, setContactName] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'expired'
  const [statusContacts, setStatusContacts] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ active: 0, completed: 0, expired: 0 });

  useEffect(() => { fetchConvos(); fetchStatus(); }, []);

  async function fetchConvos() {
    setLoading(true);
    try {
      const res = await api.get('/chatbot/conversations');
      setConvos(res.data.conversations || []);
    } catch { toast.error('Failed to load conversations'); }
    finally { setLoading(false); }
  }

  async function fetchStatus(filter) {
    try {
      const f = filter || '';
      const res = await api.get(`/chatbot/conversation-status${f ? `?status=${f}` : ''}`);
      setStatusContacts(res.data.contacts || []);
      setStatusCounts(res.data.counts || { active: 0, completed: 0, expired: 0 });
    } catch (err) { console.error('Failed to load conversation status:', err.message); }
  }

  async function openConvo(phone) {
    setSelectedPhone(phone);
    setLoadingMsgs(true);
    try {
      const res = await api.get(`/chatbot/conversations/${phone}`);
      setMessages(res.data.messages || []);
      setContactName(res.data.name || '');
    } catch { toast.error('Failed to load messages'); }
    finally { setLoadingMsgs(false); }
  }

  async function deleteConvo(phone, e) {
    e.stopPropagation();
    if (!confirm(`Delete all chat logs for ${phone}?`)) return;
    try {
      await api.delete(`/chatbot/conversations/${phone}`);
      toast.success('Conversation deleted');
      setConvos(prev => prev.filter(c => c.phone !== phone));
      if (selectedPhone === phone) { setSelectedPhone(null); setMessages([]); }
    } catch { toast.error('Delete failed'); }
  }

  function handleFilterChange(f) {
    setStatusFilter(f);
    fetchStatus(f === 'all' ? '' : f);
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts.includes('T') ? ts : ts + 'Z');
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  function getStatusBadge(status) {
    if (status === 'completed') return { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' };
    if (status === 'expired') return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pending' };
    return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Active' };
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>;

  return (
    <div className="space-y-4">
      {/* Status Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => handleFilterChange('completed')}
          className={`p-3 rounded-xl border-2 transition-all ${statusFilter === 'completed' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" />
            <div className="text-left">
              <p className="text-lg font-bold text-gray-800">{statusCounts.completed}</p>
              <p className="text-[10px] text-gray-500">Completed</p>
            </div>
          </div>
        </button>
        <button onClick={() => handleFilterChange('expired')}
          className={`p-3 rounded-xl border-2 transition-all ${statusFilter === 'expired' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            <div className="text-left">
              <p className="text-lg font-bold text-gray-800">{statusCounts.expired}</p>
              <p className="text-[10px] text-gray-500">Pending / No Reply</p>
            </div>
          </div>
        </button>
        <button onClick={() => handleFilterChange('all')}
          className={`p-3 rounded-xl border-2 transition-all ${statusFilter === 'all' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'}`}>
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-500" />
            <div className="text-left">
              <p className="text-lg font-bold text-gray-800">{statusCounts.active + statusCounts.completed + statusCounts.expired}</p>
              <p className="text-[10px] text-gray-500">All Chats</p>
            </div>
          </div>
        </button>
      </div>

      {/* Status Contact List (Completed / Expired) */}
      {statusFilter !== 'all' && statusContacts.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            {statusFilter === 'completed' ? <CheckCircle size={14} className="text-green-500" /> : <Clock size={14} className="text-orange-500" />}
            {statusFilter === 'completed' ? 'Completed Conversations' : 'Pending — No Reply (Daily Follow-up)'}
            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">{statusContacts.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {statusContacts.map(sc => {
              const badge = getStatusBadge(sc.status);
              return (
                <div key={sc.phone}
                  onClick={() => openConvo(sc.phone)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${sc.status === 'completed' ? 'bg-green-100' : 'bg-orange-100'}`}>
                    {sc.status === 'completed' ? <CheckCircle size={14} className="text-green-500" /> : <Clock size={14} className="text-orange-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{sc.contact_name || sc.phone}</p>
                    {sc.contact_name && <p className="text-[10px] text-gray-400 truncate">{sc.phone}</p>}
                    <p className="text-[10px] text-gray-400">{sc.flow_name || 'Unknown Flow'}</p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: 450 }}>
        {/* Left - Contact list */}
        <div className="md:col-span-1 bg-white rounded-xl shadow overflow-hidden flex flex-col" style={{ maxHeight: 550 }}>
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <MessageSquare size={14} className="text-indigo-500" />
              Chat Logs
              <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{convos.length}</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <MessageSquare size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-[10px] mt-1">Conversations will appear here when users reply to the bot</p>
              </div>
            ) : convos.map(c => (
              <div
                key={c.phone}
                onClick={() => openConvo(c.phone)}
                className={`px-4 py-3 border-b cursor-pointer transition-colors hover:bg-indigo-50 ${selectedPhone === c.phone ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <User size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.phone}</p>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatTime(c.last_activity)}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {c.last_direction === 'outgoing' ? 'Bot: ' : 'User: '}
                      {c.last_message?.substring(0, 40)}{c.last_message?.length > 40 ? '...' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{c.total_messages}</span>
                    <button onClick={(e) => deleteConvo(c.phone, e)} className="text-gray-300 hover:text-red-500 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t bg-gray-50">
            <button onClick={() => { fetchConvos(); fetchStatus(statusFilter === 'all' ? '' : statusFilter); }} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {/* Right - Chat messages */}
        <div className="md:col-span-2 bg-white rounded-xl shadow overflow-hidden flex flex-col" style={{ maxHeight: 550 }}>
          {!selectedPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
              <MessageSquare size={48} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-[10px] mt-1">Click on a contact from the left to view chat</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
                <button onClick={() => { setSelectedPhone(null); setMessages([]); }} className="md:hidden p-1 hover:bg-gray-200 rounded">
                  <ArrowRight size={16} className="rotate-180 text-gray-500" />
                </button>
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <User size={14} className="text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{contactName || selectedPhone}</p>
                  {contactName && <p className="text-[10px] text-gray-400">{selectedPhone}</p>}
                </div>
                <span className="ml-auto text-[10px] text-gray-400">{messages.length} messages</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ backgroundColor: '#e5ddd5', backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAJklEQVQYV2P8+vXrfwYGBgZGRkZGBjDAIszAwMDAxAAGQJoRxAcAL5YGCXPO+kwAAAAASUVORK5CYII=")', backgroundRepeat: 'repeat' }}>
                {loadingMsgs ? (
                  <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-8">No messages</div>
                ) : messages.map(m => {
                  const isBot = m.direction === 'outgoing';
                  return (
                    <div key={m.id} className={`flex ${isBot ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed shadow-sm ${
                          isBot
                            ? 'bg-[#dcf8c6] text-gray-800 rounded-2xl rounded-tr-md'
                            : 'bg-white text-gray-800 rounded-2xl rounded-tl-md'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold ${isBot ? 'text-green-600' : 'text-blue-500'}`}>
                            {isBot ? 'BOT' : 'USER'}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{m.message}</p>
                        <p className="text-[9px] mt-1 text-right text-gray-400">
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickSend() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [savedFlows, setSavedFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState('');
  const [selectedFlowData, setSelectedFlowData] = useState(null);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [recentSent, setRecentSent] = useState([]);
  const imgRef = useRef(null);

  useEffect(() => {
    api.get('/chatbot/flows').then(r => setSavedFlows(r.data.flows || [])).catch(err => console.error('Failed to load flows:', err.message));
    api.get('/messages?limit=5').then(r => setRecentSent(r.data.messages || [])).catch(err => console.error('Failed to load recent messages:', err.message));
  }, []);

  const handleFlowChange = async (id) => {
    setSelectedFlow(id);
    if (id) {
      try {
        const res = await api.get(`/chatbot/flows/${id}`);
        const flow = res.data;
        setSelectedFlowData(flow);
        // Set first step message as the message
        if (flow.steps && flow.steps.length > 0) {
          setMessage(flow.steps[0].message);
        }
      } catch {
        toast.error('Failed to load flow');
      }
    } else {
      setSelectedFlowData(null);
      setMessage('');
    }
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const form = new FormData();
      form.append('image', file);
      try {
        const res = await api.post('/messages/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        setImages(prev => [...prev, { url: res.data.url, filename: res.data.filename, preview: res.data.url }]);
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeImage = async (idx) => {
    const img = images[idx];
    try { await api.delete(`/messages/upload-image/${img.filename}`); } catch {}
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!phone) return toast.error('Phone number required');
    if (!message) return toast.error('Message required');
    setSending(true);
    setResult(null);
    try {
      const payload = { phone, message };
      if (selectedFlow && selectedFlowData) {
        payload.flow_id = parseInt(selectedFlow);
      }
      if (images.length > 0) {
        payload.media = images.map(img => ({ url: img.url, filename: img.filename, caption: '' }));
      }
      const res = await api.post('/chatbot/quick-send', payload);
      setResult(res.data);
      toast.success('Message sent!');
      setRecentSent(prev => [{ phone, body: message, status: 'queued', sent_at: new Date().toISOString(), id: res.data.id }, ...prev.slice(0, 4)]);
      setPhone('');
      setMessage('');
      setImages([]);
      setSelectedFlow('');
      setSelectedFlowData(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const previewMsg = () => {
    return message;
  };

  return (
    <div className="space-y-4">
      {/* Recipient Card */}
      <div className="bg-white rounded-xl shadow border-l-4 border-[var(--color-primary)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 bg-[var(--color-primary-light)] rounded-full flex items-center justify-center">
            <User size={16} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Recipient Phone Number</label>
            <div className="flex items-center">
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1.5 rounded-l border border-r-0 font-mono">+91</span>
              <input
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 px-3 py-1.5 border rounded-r text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none font-mono"
                maxLength={12}
              />
            </div>
          </div>
          {phone.length >= 10 && (
            <span className="text-xs bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle size={10} /> Valid
            </span>
          )}
        </div>
      </div>

      {/* Message Compose Card */}
      <div className="bg-white rounded-xl shadow border-l-4 border-blue-400">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-blue-500" />
            <span className="font-semibold text-sm">Compose Message</span>
          </div>
          {message && <span className="text-[10px] text-gray-400">{message.length} chars</span>}
        </div>
        <div className="px-4 py-4 space-y-4">
          {/* Flow Selector */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Select Chatbot Flow</label>
            {savedFlows.length > 0 ? (
              <select
                value={selectedFlow}
                onChange={(e) => handleFlowChange(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none bg-gray-50"
              >
                <option value="">-- Write custom message --</option>
                {savedFlows.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-gray-400 italic py-2">No saved flows. Go to Chatbot Builder tab to create one.</p>
            )}
          </div>

          {/* Flow Steps Preview */}
          {selectedFlowData && (
            <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-medium)] rounded-lg p-3">
              <div className="flex items-start gap-2">
                <MessageSquare size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--color-primary-dark)] text-sm">{selectedFlowData.name}</p>
                  <p className="text-xs text-[var(--color-primary)] mt-0.5">{selectedFlowData.steps?.length || 0} steps — first message will be sent, replies will trigger the flow</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedFlowData.steps?.map((s, i) => (
                      <span key={s.id} className={`text-[10px] px-2 py-0.5 rounded font-medium ${i === 0 ? 'bg-[var(--color-primary-medium)] text-[var(--color-primary-dark)]' : s.options?.length === 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              {selectedFlowData ? 'First Message (from flow)' : 'Message Body'}
            </label>
            <textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => { setMessage(e.target.value); if (selectedFlow) { setSelectedFlow(''); setSelectedFlowData(null); } }}
              rows={5}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none font-mono"
            />
          </div>

          {/* Mini Preview */}
          {message && (
            <div className="bg-[#e5ddd5] rounded-lg p-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-[#dcf8c6] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                  {images.length > 0 && (
                    <div className={`mb-2 ${images.length === 1 ? '' : 'flex gap-1 overflow-x-auto'}`}>
                      {images.map((img, i) => (
                        <img key={i} src={img.preview} alt="" className={`rounded ${images.length === 1 ? 'w-full max-h-32 object-cover' : 'w-16 h-16 object-cover shrink-0'}`} />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{previewMsg()}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-400">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    <svg width="12" height="8" viewBox="0 0 16 11" className="text-[#4fc3f7]">
                      <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.343-.15.486.486 0 0 0-.343.15l-.546.547a.505.505 0 0 0 0 .689l2.787 2.926c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                      <path fill="currentColor" d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.462.462 1.893 1.986c.092.093.21.178.328.178.118 0 .236-.085.328-.178l.564-.564 6.685-8.252a.468.468 0 0 0 .068-.435.436.436 0 0 0-.127-.186l-.485-.342z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachments Card */}
      <div className="bg-white rounded-xl shadow border-l-4 border-indigo-400">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImagePlus size={16} className="text-indigo-500" />
            <span className="font-semibold text-sm">Attachments</span>
            {images.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                {images.length} image{images.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => imgRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium disabled:opacity-50"
          >
            <ImagePlus size={12} />
            {uploading ? 'Uploading...' : 'Add Images'}
          </button>
          <input ref={imgRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        </div>
        {images.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-indigo-300 transition">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {images.length === 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400 italic">No attachments - click "Add Images" to attach photos</p>
          </div>
        )}
      </div>

      {/* Send Action Bar */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-sm text-gray-600 font-medium">
                {phone ? `To: +91${phone}` : 'Enter phone number'}
              </p>
              {selectedFlowData && (
                <p className="text-xs text-[var(--color-primary)] font-medium">Flow: {selectedFlowData.name}</p>
              )}
            </div>
            {result && (
              <span className="flex items-center gap-1 bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full text-xs font-medium">
                <CheckCircle size={10} /> Sent (ID: {result.id})
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !message || !phone || phone.length < 10}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg transition text-sm font-medium w-full sm:w-auto ${
              message && phone && phone.length >= 10
                ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                : 'bg-[var(--color-primary-medium)] text-white cursor-not-allowed'
            }`}
          >
            <Send size={14} />
            {sending ? 'Sending...' : images.length > 0 ? `Send with ${images.length} Image${images.length > 1 ? 's' : ''}` : 'Send Message'}
          </button>
        </div>
      </div>

      {/* Recent Messages */}
      {recentSent.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="px-4 py-2.5 bg-gray-50 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700">
              <Clock size={14} className="text-gray-400" />
              Recent Messages
            </h3>
          </div>
          <div className="divide-y">
            {recentSent.slice(0, 5).map((msg, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition">
                {msg.status === 'sent' ? <CheckCircle size={14} className="text-[var(--color-primary)] shrink-0" /> : msg.status === 'failed' ? <XCircle size={14} className="text-red-500 shrink-0" /> : <Clock size={14} className="text-yellow-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 text-xs font-mono">{msg.phone}</p>
                  <p className="text-xs text-gray-400 truncate">{msg.body}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${msg.status === 'sent' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : msg.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {msg.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Main Page ──
export default function ChatbotBuilder() {
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'bulk' | 'quick' | 'conversations'
  const [flow, setFlow] = useState(exampleFlow);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);
  const [activeFlowId, setActiveFlowId] = useState(null);
  const [openCampaignId, setOpenCampaignId] = useState(null);

  // Load saved flows from backend
  const loadFlows = () => {
    api.get('/chatbot/flows').then((res) => {
      setSavedFlows(res.data.flows);
      const active = res.data.flows.find((f) => f.is_active);
      if (active) {
        setActiveFlowId(active.id);
        // Auto-load active flow with all saved data (including notify)
        api.get(`/chatbot/flows/${active.id}`).then(r => {
          setFlow({ ...r.data, dbId: r.data.id, steps: r.data.steps });
        }).catch(err => console.error('Failed to load active flow:', err.message));
      }
    }).catch(err => console.error('Failed to load flows:', err.message));
  };

  useEffect(() => { loadFlows(); }, []);

  const updateStep = (index, newStep) => {
    const steps = [...flow.steps];
    steps[index] = newStep;
    setFlow({ ...flow, steps });
  };

  const deleteStep = (index) => {
    if (!confirm('Delete this step?')) return;
    const deletedId = flow.steps[index].id;
    const steps = flow.steps.filter((_, i) => i !== index).map((s) => ({
      ...s,
      options: s.options.map((o) => o.next === deletedId ? { ...o, next: '' } : o),
    }));
    setFlow({ ...flow, steps });
  };

  const addStep = () => {
    const id = `step_${Date.now()}`;
    setFlow({
      ...flow,
      steps: [
        ...flow.steps,
        { id, name: 'New Step', message: 'Your message here...', options: [] },
      ],
    });
  };

  const saveFlow = async () => {
    try {
      if (flow.dbId) {
        await api.put(`/chatbot/flows/${flow.dbId}`, { name: flow.name, description: flow.description, steps: flow.steps });
        toast.success('Flow updated!');
      } else {
        const res = await api.post('/chatbot/flows', { name: flow.name, description: flow.description, steps: flow.steps });
        setFlow({ ...flow, dbId: res.data.id });
        toast.success('Flow saved!');
      }
      loadFlows();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const activateFlow = async (id) => {
    try {
      await api.post(`/chatbot/flows/${id}/activate`);
      setActiveFlowId(id);
      loadFlows();
      toast.success('Chatbot activated! It will now auto-reply to incoming messages.');
    } catch (err) {
      toast.error('Failed to activate');
    }
  };

  const deactivateAll = async () => {
    try {
      await api.post('/chatbot/flows/deactivate');
      setActiveFlowId(null);
      loadFlows();
      toast.success('Chatbot deactivated');
    } catch (err) {
      toast.error('Failed to deactivate');
    }
  };

  const deleteFlow = async (id) => {
    if (!confirm('Delete this flow?')) return;
    await api.delete(`/chatbot/flows/${id}`);
    loadFlows();
    toast.success('Deleted');
  };

  const loadSavedFlow = async (id) => {
    const res = await api.get(`/chatbot/flows/${id}`);
    setFlow({ ...res.data, dbId: res.data.id, steps: res.data.steps });
    toast.success('Loaded');
  };

  const loadTemplate = (template) => {
    setFlow({ name: template.name, description: template.description, dbId: null, steps: template.steps });
    setShowTemplates(false);
    toast.success(`"${template.name}" loaded!`);
  };

  const newFlow = () => {
    setFlow({
      name: 'New Chatbot',
      description: '',
      dbId: null,
      steps: [
        { id: 'start', name: 'Welcome', message: 'Hello! How can I help you today?\n\n1️⃣ Option A\n2️⃣ Option B', options: [{ label: '1 - Option A', next: '' }, { label: '2 - Option B', next: '' }] },
      ],
    });
  };

  return (
    <div>
      {/* Page Header + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Chatbot & Campaign</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Build chatbot flows, design campaigns, send bulk & single messages</p>
        </div>
        {activeTab === 'builder' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowTemplates(true)} className="px-3 py-2 text-xs md:text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition flex items-center gap-1">
              <Copy size={14} /> Templates
            </button>
            <button onClick={newFlow} className="px-3 py-2 text-xs md:text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
              New
            </button>
            <button data-save-flow onClick={saveFlow} className="flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Save size={14} /> Save
            </button>
            <button
              onClick={() => setShowSimulator(true)}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition"
            >
              <Play size={14} /> Test
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 md:mb-6 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'builder'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare size={14} /> <span className="hidden sm:inline">Chatbot</span> Builder
        </button>
        <button
          onClick={() => setActiveTab('campaign')}
          className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'campaign'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Megaphone size={14} /> Campaign Builder
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'bulk'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet size={14} /> Bulk
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'quick'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send size={14} /> Quick Send
        </button>
        <button
          onClick={() => setActiveTab('conversations')}
          className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'conversations'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <User size={14} /> Conversations
        </button>
      </div>

      {/* Campaign Builder Tab */}
      {activeTab === 'campaign' && <CampaignBuilder initialCampaignId={openCampaignId} onClearInitial={() => setOpenCampaignId(null)} />}

      {/* Quick Send Tab */}
      {activeTab === 'quick' && <QuickSend />}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && <Conversations />}

      {/* Bulk Messages Tab — kept mounted to preserve polling & state */}
      <div style={{ display: activeTab === 'bulk' ? 'block' : 'none' }}>
        <BulkMessages onOpenCampaign={(id) => { setOpenCampaignId(id); setActiveTab('campaign'); }} />
      </div>

      {/* Builder Tab */}
      {activeTab === 'builder' && (<>


      {/* Flow info */}
      <div className="bg-white rounded-xl shadow p-4 md:p-5 mb-4 md:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bot Name</label>
            <input
              value={flow.name}
              onChange={(e) => setFlow({ ...flow, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <input
              value={flow.description}
              onChange={(e) => setFlow({ ...flow, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Flow overview mini-map */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h3 className="font-semibold text-sm mb-3">Flow Map</h3>
        <div className="flex flex-wrap gap-3">
          {flow.steps.map((step, i) => (
            <div key={step.id} className="relative">
              <div className={`px-3 py-2 rounded-lg text-xs font-medium border-2 ${
                i === 0 ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' :
                step.options.length === 0 ? 'border-red-300 bg-red-50 text-red-600' :
                'border-blue-300 bg-blue-50 text-blue-700'
              }`}>
                {step.name}
                <div className="text-[10px] font-normal text-gray-400 mt-0.5">{step.id}</div>
              </div>
              {step.options.length > 0 && (
                <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                  {step.options.map((o, j) => (
                    <div key={j} className="flex items-center gap-1">
                      <ArrowRight size={8} />
                      <span>{o.next || 'END'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--color-primary)] rounded" /> Start</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400 rounded" /> Step</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-400 rounded" /> End</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        {flow.steps.map((step, i) => (
          <StepEditor
            key={step.id}
            step={step}
            allSteps={flow.steps}
            isFirst={i === 0}
            onChange={(s) => updateStep(i, s)}
            onDelete={() => deleteStep(i)}
            onSave={saveFlow}
          />
        ))}
      </div>

      {/* Add step */}
      <button
        onClick={addStep}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition flex items-center justify-center gap-2"
      >
        <Plus size={18} /> Add Step
      </button>

      {/* Saved flows */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Saved Flows</h3>
          {activeFlowId && (
            <button onClick={deactivateAll} className="text-xs text-red-600 hover:underline">
              Deactivate Chatbot
            </button>
          )}
        </div>
        {savedFlows.length === 0 && (
          <p className="text-gray-400 text-sm">No saved flows yet. Create one and click Save.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {savedFlows.map((f) => (
            <div key={f.id} className={`bg-white rounded-xl shadow p-4 border-2 ${f.is_active ? 'border-[var(--color-primary)]' : 'border-transparent'}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{f.name}</p>
                  <p className="text-xs text-gray-400">{f.description}</p>
                </div>
                {f.is_active && (
                  <span className="text-xs bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full font-medium animate-pulse">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => loadSavedFlow(f.id)} className="text-xs text-blue-600 hover:underline">
                  Edit
                </button>
                {!f.is_active ? (
                  <button onClick={() => activateFlow(f.id)} className="text-xs text-[var(--color-primary)] hover:underline font-medium">
                    Activate
                  </button>
                ) : (
                  <button onClick={deactivateAll} className="text-xs text-orange-600 hover:underline">
                    Deactivate
                  </button>
                )}
                <button onClick={() => deleteFlow(f.id)} className="text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulator modal */}
      {showSimulator && (
        <ChatSimulator flow={flow} onClose={() => setShowSimulator(false)} />
      )}

      {/* Templates picker modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplates(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 md:p-6 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Chatbot Templates</h3>
                <p className="text-sm text-gray-500 mt-0.5">Choose a pre-built template to get started quickly</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {chatbotTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  className="text-left border rounded-xl p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/50 transition group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-800 group-hover:text-[var(--color-primary-dark)] transition">{t.name}</h4>
                      <span className="text-xs text-gray-400">{t.category}</span>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                      <p className="text-xs text-gray-400 mt-2">{t.steps.length} steps</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
