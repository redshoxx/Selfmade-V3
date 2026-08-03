import { escapeHtml } from '../utils/escape-html.js';
export const emptyState = (title, detail = '') => `<div class="empty"><strong>${escapeHtml(title)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}</div>`;
