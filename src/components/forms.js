import { escapeHtml } from '../utils/escape-html.js';

function attr(name, value) {
  return value === undefined || value === null || value === false ? '' : ` ${name}="${escapeHtml(value === true ? name : value)}"`;
}
function inputDefaults(type, opts) {
  const defaults = type === 'email' ? { inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' }
    : type === 'password' ? { autocapitalize: 'none', spellcheck: 'false' }
      : type === 'number' ? { inputmode: opts.step && Number(opts.step) < 1 ? 'decimal' : 'numeric' }
        : type === 'search' ? { enterkeyhint: 'search', autocapitalize: 'sentences' }
          : { autocapitalize: 'sentences' };
  return { ...defaults, ...opts };
}
export function field(label, name, value = '', type = 'text', options = {}) {
  const opts = inputDefaults(type, options);
  const attributes = [
    attr('required', opts.required), attr('min', opts.min), attr('max', opts.max), attr('step', opts.step),
    attr('inputmode', opts.inputmode), attr('autocomplete', opts.autocomplete ?? 'off'), attr('maxlength', opts.maxlength),
    attr('minlength', opts.minlength), attr('pattern', opts.pattern), attr('enterkeyhint', opts.enterkeyhint),
    attr('autocapitalize', opts.autocapitalize), attr('spellcheck', opts.spellcheck),
    opts.positive ? ' data-positive="true"' : ''
  ].join('');
  return `<div class="field"><label for="f-${escapeHtml(name)}">${escapeHtml(label)}${opts.required ? '<span class="required">*</span>' : ''}</label><input class="input" id="f-${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}"${attributes}><small class="field-error" aria-live="polite"></small></div>`;
}
export const textarea = (label, name, value = '', opts = {}) => `<div class="field"><label for="f-${escapeHtml(name)}">${escapeHtml(label)}${opts.required ? '<span class="required">*</span>' : ''}</label><textarea class="textarea" id="f-${escapeHtml(name)}" name="${escapeHtml(name)}"${attr('required', opts.required)}${attr('maxlength', opts.maxlength)}${attr('autocomplete', opts.autocomplete ?? 'off')}${attr('autocapitalize', opts.autocapitalize ?? 'sentences')}>${escapeHtml(value)}</textarea><small class="field-error" aria-live="polite"></small></div>`;
export const select = (label, name, value, options, opts = {}) => `<div class="field"><label for="f-${escapeHtml(name)}">${escapeHtml(label)}${opts.required ? '<span class="required">*</span>' : ''}</label><select class="select" id="f-${escapeHtml(name)}" name="${escapeHtml(name)}"${attr('required', opts.required)}>${options.map(option => { const v = typeof option === 'string' ? option : option.value; const l = typeof option === 'string' ? option : option.label; return `<option value="${escapeHtml(v)}" ${String(v) === String(value) ? 'selected' : ''}>${escapeHtml(l)}</option>`; }).join('')}</select><small class="field-error" aria-live="polite"></small></div>`;
export const checkbox = (label, name, checked = false) => `<label class="checkbox"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
