const { format, toZonedTime } = require('date-fns-tz');

const ISRAEL_TZ = 'Asia/Jerusalem';

// Helper function to format timestamp for Israel timezone
const formatIsraelTime = (timestamp) => {
  if (!timestamp) return null;
  try {
    return format(toZonedTime(new Date(timestamp), ISRAEL_TZ), 'yyyy-MM-dd HH:mm:ss', { timeZone: ISRAEL_TZ });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

// Helper function to get current time in Israel timezone
const getCurrentIsraelTime = () => {
  return format(toZonedTime(new Date(), ISRAEL_TZ), 'yyyy-MM-dd HH:mm:ss', { timeZone: ISRAEL_TZ });
};

module.exports = {
  ISRAEL_TZ,
  formatIsraelTime,
  getCurrentIsraelTime
}; 