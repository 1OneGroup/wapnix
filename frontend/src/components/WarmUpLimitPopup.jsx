export default function WarmUpLimitPopup({ currentDay, limit, sent, remaining, onSwitch, onStop }) {
  const nextDay = Math.min(currentDay + 1, 8);
  const nextLimit = nextDay <= 7
    ? Math.round(20 * Math.pow(1.8, nextDay - 1))
    : 'Unlimited';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">&#9888;</span>
          </div>
          <h3 className="text-lg font-bold text-gray-800">Day {currentDay} Limit Reached!</h3>
          <p className="text-sm text-gray-500 mt-1">{sent} / {limit} messages sent</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Next: Day {nextDay <= 7 ? nextDay : '8+'}</span>
            <span className="font-semibold text-gray-800">{nextLimit} messages</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Remaining contacts</span>
            <span className="font-semibold text-gray-800">{remaining}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onStop}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
          >
            Stop
          </button>
          <button
            onClick={() => onSwitch(nextDay)}
            className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition"
          >
            Switch to Day {nextDay <= 7 ? nextDay : '8+'}
          </button>
        </div>
      </div>
    </div>
  );
}
