import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, X, Zap, Star, Crown, Rocket,
  MessageSquare, Users, FileText, Bot,
  Code, Headphones, ArrowRight, Infinity,
} from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    icon: Zap,
    color: '#6b7280',
    monthly: 0,
    yearly: 0,
    yearlyPerMonth: 0,
    description: 'Get started with WhatsApp automation',
    badge: null,
    features: [
      { text: '100 messages/day', included: true },
      { text: '200 contacts', included: true },
      { text: '10 templates', included: true },
      { text: '1 chatbot flow', included: true },
      { text: 'Basic dashboard', included: true },
      { text: 'API access', included: false },
      { text: 'Follow-up automation', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    icon: Star,
    color: '#3b82f6',
    monthly: 999,
    yearly: 9590,
    yearlyPerMonth: 799,
    description: 'Perfect for small businesses',
    badge: null,
    features: [
      { text: '500 messages/day', included: true },
      { text: '2,000 contacts', included: true },
      { text: '50 templates', included: true },
      { text: '5 chatbot flows', included: true },
      { text: 'Advanced dashboard', included: true },
      { text: 'API access', included: true },
      { text: 'Follow-up automation', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Rocket,
    color: '#8b5cf6',
    monthly: 2499,
    yearly: 23990,
    yearlyPerMonth: 1999,
    description: 'For growing businesses & teams',
    badge: 'Popular',
    features: [
      { text: '2,000 messages/day', included: true },
      { text: '10,000 contacts', included: true },
      { text: '200 templates', included: true },
      { text: 'Unlimited chatbot flows', included: true },
      { text: 'Advanced dashboard', included: true },
      { text: 'API access', included: true },
      { text: 'Follow-up automation', included: true },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    icon: Crown,
    color: '#f59e0b',
    monthly: 4999,
    yearly: 47990,
    yearlyPerMonth: 3999,
    description: 'Unlimited power for enterprises',
    badge: 'Best Value',
    features: [
      { text: 'Unlimited messages', included: true, highlight: true },
      { text: 'Unlimited contacts', included: true, highlight: true },
      { text: 'Unlimited templates', included: true, highlight: true },
      { text: 'Unlimited chatbot flows', included: true },
      { text: 'Advanced dashboard', included: true },
      { text: 'API access', included: true },
      { text: 'Follow-up automation', included: true },
      { text: 'Priority support', included: true },
    ],
  },
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <MessageSquare size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Wapnix</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your business. Start free, scale as you grow.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1.5">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !isYearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isYearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Yearly
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {plans.map((plan) => {
            const price = isYearly ? plan.yearlyPerMonth : plan.monthly;
            const totalYearly = plan.yearly;
            const isPopular = plan.badge === 'Popular';
            const isBusiness = plan.id === 'business';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 sm:p-7 flex flex-col transition-all duration-300 hover:shadow-xl ${
                  isPopular
                    ? 'bg-white border-2 shadow-lg scale-[1.02]'
                    : isBusiness
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 shadow-lg'
                    : 'bg-white border border-gray-200 shadow-sm hover:border-gray-300'
                }`}
                style={{
                  borderColor: isPopular ? plan.color : isBusiness ? '#f59e0b' : undefined,
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: plan.color }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Icon & Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: plan.color + '15' }}
                  >
                    <plan.icon size={22} style={{ color: plan.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                    <p className="text-[11px] text-gray-400">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {price === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-gray-900">Free</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg text-gray-400">₹</span>
                        <span className="text-4xl font-extrabold text-gray-900">
                          {price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-sm text-gray-400">/mo</span>
                      </div>
                      {isYearly && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-gray-400 line-through">
                            ₹{plan.monthly.toLocaleString('en-IN')}/mo
                          </span>
                          <span className="text-xs text-green-600 font-medium">
                            Save ₹{((plan.monthly * 12) - totalYearly).toLocaleString('en-IN')}/yr
                          </span>
                        </div>
                      )}
                      {isYearly && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Billed ₹{totalYearly.toLocaleString('en-IN')} yearly
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => navigate('/register')}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 mb-6 ${
                    isPopular || isBusiness
                      ? 'text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                      : 'border-2 hover:bg-gray-50'
                  }`}
                  style={{
                    backgroundColor: isPopular || isBusiness ? plan.color : 'transparent',
                    borderColor: isPopular || isBusiness ? plan.color : '#d1d5db',
                    color: isPopular || isBusiness ? '#ffffff' : '#374151',
                  }}
                >
                  {price === 0 ? 'Start Free' : 'Get Started'}
                  <ArrowRight size={16} />
                </button>

                {/* Features */}
                <div className="space-y-3 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      {feature.included ? (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: plan.color + '15' }}
                        >
                          <Check size={12} style={{ color: plan.color }} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <X size={12} className="text-gray-300" strokeWidth={3} />
                        </div>
                      )}
                      <span
                        className={`text-sm ${
                          feature.highlight
                            ? 'font-semibold text-gray-900'
                            : feature.included
                            ? 'text-gray-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {feature.text}
                        {feature.highlight && (
                          <Infinity size={14} className="inline ml-1 text-amber-500" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-10 max-w-3xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
              All Plans Include
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              {[
                { icon: MessageSquare, label: 'WhatsApp Web Connection', color: '#10b981' },
                { icon: Bot, label: 'Chatbot Builder', color: '#8b5cf6' },
                { icon: FileText, label: 'Message Templates', color: '#3b82f6' },
                { icon: Users, label: 'Contact Management', color: '#f59e0b' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: item.color + '15' }}
                  >
                    <item.icon size={24} style={{ color: item.color }} />
                  </div>
                  <span className="text-xs sm:text-sm text-gray-600 font-medium text-center">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ-like trust section */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Check size={16} className="text-green-500" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={16} className="text-green-500" /> Cancel anytime
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={16} className="text-green-500" /> 24/7 WhatsApp support
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
