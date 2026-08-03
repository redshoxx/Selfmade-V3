import {escapeHtml} from '../utils/escape-html.js';
const root=()=>document.querySelector('#toast-root');
export function toast(message,type=''){const text=String(message||'');if(/cloud[- ]daten (aktualisiert|synchronisiert)|offline[- ]änderungen synchronisiert|supabase-synchronisierung abgeschlossen/i.test(text))return;root().replaceChildren();const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=escapeHtml(text);root().append(el);setTimeout(()=>el.remove(),type==='error'?2800:1800)}
