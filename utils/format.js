function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value) { return value < 10 ? '0' + value : String(value); }

function formatClock(value) {
  const date = parseDate(value);
  return date ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : '';
}

function formatListTime(value) {
  const date = parseDate(value);
  if (!date) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((today.getTime() - day.getTime()) / 86400000);
  if (days === 0) return formatClock(date);
  if (days === 1) return '昨天 ' + formatClock(date);
  if (date.getFullYear() === now.getFullYear()) return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  return date.getFullYear() + '/' + pad(date.getMonth() + 1) + '/' + pad(date.getDate());
}

function avatarInitial(name) {
  const value = String(name || '邻').trim();
  return value ? value.slice(0, 1) : '邻';
}

module.exports = { formatClock, formatListTime, avatarInitial };
