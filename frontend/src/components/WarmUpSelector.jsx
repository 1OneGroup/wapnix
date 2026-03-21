import { useState, useEffect } from 'react';

const WARMUP_LIMITS = [20, 36, 65, 117, 210, 378, 680, Infinity];
const DAY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8+'];

export function getWarmupLimit(day) {
  return WARMUP_LIMITS[Math.min(day - 1, 7)];
}

export default function WarmUpSelector({ storageKey, onDayChange }) {
  const [day, setDay] = useState(() => {
    try { return parseInt(localStorage.getItem(`${storageKey}_day`) || '1'); } catch { return 1; }
  });
  const [sent, setSent] = useState(() => {
    try { return parseInt(localStorage.getItem(`${storageKey}_sent`) || '0'); } catch { return 0; }
  });

  useEffect(() => {
    localStorage.setItem(`${storageKey}_day`, String(day));
    onDayChange?.({ day, limit: getWarmupLimit(day), sent });
  }, [day]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_sent`, String(sent));
  }, [sent]);

  const limit = getWarmupLimit(day);
  const isUnlimited = limit === Infinity;
  const percent = isUnlimited ? 0 : Math.min(100, Math.round((sent / limit) * 100));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Warm-up Plan</span>
        <span className="text-xs text-gray-500">
          {isUnlimited ? 'Unlimited' : `${sent} / ${limit} messages`}
        </span>
      </div>

      {/* Day circle buttons */}
      <div className="flex items-center gap-2 mb-3">
        {DAY_LABELS.map((label, i) => {
          const dayNum = i + 1;
          const isActive = day === dayNum;
          const isPast = day > dayNum;
          return (
            <button
              key={dayNum}
              onClick={() => { setDay(dayNum); setSent(0); }}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center border-2 ${
                isActive
                  ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-200'
                  : isPast
                  ? 'bg-green-100 border-green-300 text-green-700'
                  : 'bg-gray-50 border-gray-300 text-gray-500 hover:border-gray-400'
              }`}
              title={`Day ${label}: ${dayNum <= 7 ? WARMUP_LIMITS[i] + ' messages' : 'Unlimited'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      {!isUnlimited && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400">
          Day {day <= 7 ? day : '8+'} — {isUnlimited ? 'No limit' : `Limit: ${limit} msgs`}
        </span>
        {sent > 0 && (
          <button onClick={() => setSent(0)} className="text-[10px] text-gray-400 hover:text-gray-600 underline">
            Reset count
          </button>
        )}
      </div>
    </div>
  );
}

export { WARMUP_LIMITS };
