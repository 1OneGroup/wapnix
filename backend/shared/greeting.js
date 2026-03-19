/**
 * Get IST-based time-of-day greeting.
 * @returns {'Good Morning' | 'Good Afternoon' | 'Good Evening'}
 */
export function getISTGreeting() {
  const istHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  if (istHour >= 5 && istHour < 12) return 'Good Morning';
  if (istHour >= 12 && istHour < 17) return 'Good Afternoon';
  return 'Good Evening';
}
