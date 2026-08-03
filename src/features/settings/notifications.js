import { expiryInfo, today } from '../../utils/dates.js';

export async function requestNotifications() {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}
export function inAppAlerts(state) {
  const p = state.settings.notification_preferences || {};
  if (!p.enabled) return [];
  const alerts = [];
  for (const item of state.pantry) {
    const e = expiryInfo(item.expiry_date);
    if (e.days === 1 && p.expiry_tomorrow) alerts.push({ id: `expiry-${item.id}`, type: 'expiry', tab: 'pantry', text: `${item.name} läuft morgen ab` });
    if (e.days === 0 && p.expired_today) alerts.push({ id: `expired-${item.id}`, type: 'expired', tab: 'pantry', text: `${item.name} ist heute abgelaufen` });
    if (item.low_stock && p.low_stock) alerts.push({ id: `low-${item.id}`, type: 'low', tab: 'pantry', text: `Mindestbestand: ${item.name}` });
  }
  for (const item of state.recurring) if (item.due && p.recurring_due) alerts.push({ id: `recurring-${item.id}`, type: 'recurring', tab: 'shopping', text: `${item.name} ist fällig` });
  for (const note of state.notes) if (note.due_date === today() && p.note_due) alerts.push({ id: `note-${note.id}`, type: 'note', tab: 'notes', text: `Notiz fällig: ${note.title}` });
  for (const budget of state.budgets) {
    if (budget.limit_amount && budget.spent >= budget.limit_amount && p.budget_exceeded) alerts.push({ id: `budget-over-${budget.id}`, type: 'budget', tab: 'money', text: `Budget überschritten: ${budget.name}` });
    else if (budget.limit_amount && budget.spent / budget.limit_amount >= .85 && p.budget_near) alerts.push({ id: `budget-near-${budget.id}`, type: 'budget-near', tab: 'money', text: `Budget fast erreicht: ${budget.name}` });
  }
  return alerts;
}
export function notificationKey(alert, date = today()) { return `selfmade-notification:${date}:${alert.id}`; }
export function wasNotified(alert) { return localStorage.getItem(notificationKey(alert)) === '1'; }
export function markNotified(alert) { localStorage.setItem(notificationKey(alert), '1'); }
