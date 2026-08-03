import { escapeHtml } from '../utils/escape-html.js';
import { icon } from './icons.js';
import { store } from '../store.js';

const root = () => document.querySelector('#dialog-root');
let closeHandler = null;
let operationDepth = 0;

function setBusy(busy) {
  const dialog = root().querySelector('.dialog');
  if (!dialog) return;
  dialog.setAttribute('aria-busy', String(busy));
  for (const button of dialog.querySelectorAll('button[type=submit],.dialog-footer .primary')) {
    if (busy) {
      button.dataset.originalLabel ||= button.textContent;
      button.disabled = true;
      button.textContent = 'Wird gespeichert …';
    } else {
      button.disabled = false;
      if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    }
  }
}
document.addEventListener('selfmade-operation-start', () => { if (store.ui.dialogOpen) { operationDepth += 1; setBusy(true); } });
document.addEventListener('selfmade-operation-end', () => { operationDepth = Math.max(0, operationDepth - 1); if (!operationDepth) setBusy(false); });

export function openDialog({ title, body, formId = '', footer = '', onClose = null, wide = false }) {
  closeHandler = onClose;
  operationDepth = 0;
  store.ui.dialogOpen = true;
  store.ui.dirty = false;
  document.body.classList.add('dialog-open');
  root().innerHTML = `<div class="dialog-backdrop"><section class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">${formId ? `<form class="dialog-form" data-form="${escapeHtml(formId)}" novalidate>` : ''}<header class="dialog-header"><h2>${escapeHtml(title)}</h2><button type="button" class="icon-btn" data-dialog-close aria-label="Schließen">${icon('close', 18)}</button></header><div class="dialog-body">${body}</div>${footer ? `<footer class="dialog-footer">${footer}</footer>` : ''}${formId ? '</form>' : ''}</section></div>`;
  root().querySelector('[data-dialog-close]').addEventListener('click', () => closeDialog());
  root().querySelector('.dialog-backdrop').addEventListener('click', event => { if (event.target === event.currentTarget && !store.ui.dirty) closeDialog(); });
  root().querySelectorAll('input,textarea,select').forEach(element => element.addEventListener('input', () => { store.ui.dirty = true; }));
}
export function closeDialog(force = false) {
  if (store.ui.dirty && !force && !confirm('Ungespeicherte Änderungen verwerfen?')) return false;
  closeHandler?.();
  closeHandler = null;
  operationDepth = 0;
  root().replaceChildren();
  store.ui.dialogOpen = false;
  store.ui.dirty = false;
  document.body.classList.remove('dialog-open', 'keyboard-open');
  return true;
}
export function dialogRoot() { return root(); }
