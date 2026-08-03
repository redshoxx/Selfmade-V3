const ALLOWED_HOSTS = new Set(['gutekueche.at', 'www.gutekueche.at']);
const MAX_HTML_BYTES = 2_500_000;

function importError(message, status = 400, code = 'gutekueche_import_error') {
  return Object.assign(new Error(message), { status, code });
}

export function normalizeGuteKuecheUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw importError('Bitte einen vollständigen GuteKueche-Rezeptlink eingeben.'); }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw importError('Es werden ausschließlich HTTPS-Rezeptlinks von GuteKueche.at unterstützt.');
  }
  url.hostname = 'www.gutekueche.at';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!/-rezept-\d+$/i.test(url.pathname)) {
    throw importError('Der Link muss direkt zu einem einzelnen GuteKueche-Rezept führen.');
  }
  return url.toString();
}

function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', szlig: 'ß', deg: '°' };
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => named[name] ?? match);
}

function cleanText(value) {
  return decodeHtml(String(value || ''))
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function flattenJsonLd(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => flattenJsonLd(item, output));
  else if (value && typeof value === 'object') {
    output.push(value);
    if (value['@graph']) flattenJsonLd(value['@graph'], output);
  }
  return output;
}

function recipeJsonLd(html) {
  const nodes = [];
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const candidates = [match[1].trim(), decodeHtml(match[1].trim())];
    for (const candidate of candidates) {
      try { flattenJsonLd(JSON.parse(candidate), nodes); break; } catch {}
    }
  }
  return nodes.find((node) => {
    const type = node?.['@type'];
    return Array.isArray(type) ? type.some((entry) => String(entry).toLowerCase() === 'recipe') : String(type || '').toLowerCase() === 'recipe';
  }) || null;
}

function isoDurationMinutes(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  const iso = text.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (iso) return Number(iso[1] || 0) * 1440 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0) + Math.round(Number(iso[4] || 0) / 60);
  const hours = Number(text.match(/(\d+(?:[.,]\d+)?)\s*(?:std|stunde|hour|h)\b/i)?.[1]?.replace(',', '.') || 0);
  const minutes = Number(text.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minute)/i)?.[1]?.replace(',', '.') || 0);
  return Math.round(hours * 60 + minutes);
}

function parseYield(value) {
  const source = Array.isArray(value) ? value[0] : value;
  const match = String(source || '').match(/\d+(?:[.,]\d+)?/);
  return Math.max(1, Math.min(50, match ? Number(match[0].replace(',', '.')) : 2));
}

function fractionValue(value) {
  const unicode = { '½': .5, '⅓': 1/3, '⅔': 2/3, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
  const text = String(value || '').trim();
  if (unicode[text] != null) return unicode[text];
  const mixed = text.match(/^(\d+)\s+([0-9]+)\/([0-9]+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^([0-9]+)\/([0-9]+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(text.replace(',', '.')) || 0;
}

function normalizeUnit(value) {
  const original = cleanText(value).replace(/\.$/, '');
  const key = original.toLocaleLowerCase('de-AT');
  const map = {
    g: 'g', gramm: 'g', kg: 'kg', kilogramm: 'kg', ml: 'ml', milliliter: 'ml', l: 'l', liter: 'l',
    stk: 'Stück', st: 'Stück', stück: 'Stück', pk: 'Packung', pkg: 'Packung', packung: 'Packung',
    el: 'EL', esslöffel: 'EL', tl: 'TL', teelöffel: 'TL', prise: 'Prise', prisen: 'Prise',
    bund: 'Bund', tasse: 'Tasse', tassen: 'Tasse', dose: 'Dose', dosen: 'Dose', zehe: 'Zehe', zehen: 'Zehe',
    scheibe: 'Scheibe', scheiben: 'Scheibe', becher: 'Becher', glas: 'Glas', zweig: 'Zweig', zweige: 'Zweig'
  };
  return map[key] || original.slice(0, 20);
}

function ingredientCategory(name) {
  const value = cleanText(name).toLocaleLowerCase('de-AT');
  if (/milch|joghurt|käse|butter|obers|sahne|rahm|topfen|quark|ei(?:er)?\b/.test(value)) return 'Kühlregal';
  if (/brot|semmel|brötchen|toast|gebäck/.test(value)) return 'Backwaren';
  if (/apfel|banane|tomat|kartoff|zwiebel|salat|paprika|karotte|gurke|knoblauch|zucchini|obst|gemüse/.test(value)) return 'Obst & Gemüse';
  if (/fleisch|huhn|hähn|pute|rind|schwein|fisch|lachs/.test(value)) return 'Fleisch & Fisch';
  if (/tiefkühl|tk\b|eis/.test(value)) return 'Tiefkühl';
  return 'Vorrat';
}

export function parseIngredientLine(value) {
  let text = cleanText(value).replace(/^[-–•]+\s*/, '');
  if (!text) return null;
  const amountPattern = '(?:\\d+(?:[.,]\\d+)?(?:\\s+[0-9]+\\/[0-9]+)?|[0-9]+\\/[0-9]+|[½⅓⅔¼¾⅛⅜⅝⅞])';
  const match = text.match(new RegExp(`^(${amountPattern})(?:\\s*[-–]\\s*${amountPattern})?\\s*([^\\s,;]*)\\s*(.*)$`, 'i'));
  let amount = 0, unit = '', name = text;
  if (match) {
    amount = fractionValue(match[1]);
    const possibleUnit = normalizeUnit(match[2]);
    const known = /^(g|kg|ml|l|Stück|Packung|EL|TL|Prise|Bund|Tasse|Dose|Zehe|Scheibe|Becher|Glas|Zweig)$/;
    if (known.test(possibleUnit)) { unit = possibleUnit; name = match[3]; }
    else { name = `${match[2]} ${match[3]}`.trim(); }
  }
  name = cleanText(name).replace(/^von\s+/i, '').trim();
  if (!name) return null;
  return { name: name.slice(0, 100), amount, unit, category: ingredientCategory(name), alternative: '' };
}

function instructionObjects(value) {
  const result = [];
  const visit = (item) => {
    if (typeof item === 'string') {
      const text = cleanText(item);
      if (text) result.push({ title: '', text, ingredients: [], media_url: '' });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const type = String(item['@type'] || '').toLowerCase();
    if (type === 'howtosection' && Array.isArray(item.itemListElement)) return item.itemListElement.forEach(visit);
    const text = cleanText(item.text || item.description || item.name || '');
    if (text) result.push({ title: cleanText(item.name || ''), text, ingredients: [], media_url: '' });
    if (!text && Array.isArray(item.itemListElement)) item.itemListElement.forEach(visit);
  };
  (Array.isArray(value) ? value : [value]).forEach(visit);
  return result.map((item, index) => ({ ...item, title: item.title || `Schritt ${index + 1}` })).slice(0, 80);
}

function fallbackText(html) {
  return cleanText(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:p|li|tr|div|h1|h2|h3|section|article)>/gi, '\n')
    .replace(/<(?:br|hr)\b[^>]*>/gi, '\n'))
    .replace(/\n{2,}/g, '\n');
}

function fallbackIngredients(text) {
  const section = text.match(/Zutaten\s+für\s+\d+\s+Portion(?:en)?\s*\n([\s\S]*?)(?:\nPortionen\b|\nEinkaufsliste\b|\nKochansicht\b|\nKategorien\b)/i)?.[1] || '';
  return section.split('\n').map(parseIngredientLine).filter(Boolean).slice(0, 100);
}

function fallbackInstructions(text) {
  const section = text.match(/\nZubereitung\s*\n([\s\S]*?)(?:\nTipps? zum Rezept\b|\nNährwert\b|\nÄHNLICHE REZEPTE\b)/i)?.[1] || '';
  return section.split(/\n(?=\d+\.\s+)/).map((line) => cleanText(line.replace(/^\d+\.\s*/, ''))).filter(Boolean).map((step, index) => ({ title: `Schritt ${index + 1}`, text: step, ingredients: [], media_url: '' })).slice(0, 80);
}

function categoryFor(value) {
  const text = (Array.isArray(value) ? value.join(' ') : String(value || '')).toLocaleLowerCase('de-AT');
  if (/frühstück/.test(text)) return 'Frühstück';
  if (/suppe/.test(text)) return 'Suppe';
  if (/salat/.test(text)) return 'Salat';
  if (/dessert|süß|nachspeise|mehlspeise/.test(text)) return 'Dessert';
  if (/back|kuchen|torte|brot/.test(text)) return 'Backen';
  if (/getränk|cocktail|drink/.test(text)) return 'Getränk';
  if (/snack|jause|vorspeise/.test(text)) return 'Snack';
  if (/beilage/.test(text)) return 'Beilage';
  return 'Hauptgericht';
}

function difficultyFor(value) {
  const text = String(value || '').toLocaleLowerCase('de-AT');
  if (/anspruchsvoll|schwierig|aufwendig/.test(text)) return 'Anspruchsvoll';
  if (/einfach|leicht|schnell|anfänger/.test(text)) return 'Einfach';
  return 'Mittel';
}

export function parseGuteKuecheHtml(html, sourceUrl) {
  const source = normalizeGuteKuecheUrl(sourceUrl);
  const document = String(html || '');
  const structured = recipeJsonLd(document);
  const text = fallbackText(document);
  const title = cleanText(structured?.name || document.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const description = cleanText(structured?.description || document.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] || '');
  const ingredients = (Array.isArray(structured?.recipeIngredient) ? structured.recipeIngredient.map(parseIngredientLine).filter(Boolean) : fallbackIngredients(text));
  const steps = instructionObjects(structured?.recipeInstructions);
  const fallbackSteps = steps.length ? steps : fallbackInstructions(text);
  if (!title || !ingredients.length || !fallbackSteps.length) {
    throw importError('Das Rezept konnte nicht vollständig gelesen werden. Prüfe den Link oder lege es manuell an.', 422, 'gutekueche_parse_failed');
  }
  const categories = structured?.recipeCategory || text.match(/Kategorien\s*\n([^\n]+)/i)?.[1] || '';
  const combined = `${description} ${Array.isArray(categories) ? categories.join(' ') : categories}`;
  const prep = isoDurationMinutes(structured?.prepTime) || Number(text.match(/(\d+)\s*min\.\s*Zubereitungszeit/i)?.[1] || 0);
  const total = isoDurationMinutes(structured?.totalTime) || Number(text.match(/(\d+)\s*min\.\s*Gesamtzeit/i)?.[1] || prep);
  return {
    name: title.slice(0, 120), image_data_url: '', description: description.slice(0, 4000),
    prep_minutes: prep, total_minutes: total || prep,
    difficulty: difficultyFor(combined), category: categoryFor(categories), favorite: false,
    servings: parseYield(structured?.recipeYield || text.match(/Zutaten\s+für\s+(\d+)\s+Portion/i)?.[1]),
    ingredients, steps: fallbackSteps,
    notes: '', source_url: source, source_name: 'GuteKueche.at',
    source_attribution: 'Importiert für den persönlichen Gebrauch. Originalquelle: GuteKueche.at',
    imported_at: new Date().toISOString()
  };
}

async function readLimitedHtml(response) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_HTML_BYTES) throw importError('Die Rezeptseite ist zu groß.', 413, 'gutekueche_response_too_large');
    return new TextDecoder().decode(buffer);
  }
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) { await reader.cancel(); throw importError('Die Rezeptseite ist zu groß.', 413, 'gutekueche_response_too_large'); }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder().decode(merged);
}

export async function fetchGuteKuecheRecipe(value, options = {}) {
  const sourceUrl = normalizeGuteKuecheUrl(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 9000);
  try {
    const response = await (options.fetchImpl || fetch)(sourceUrl, {
      redirect: 'follow', signal: controller.signal,
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Selfmade-Haushaltsapp/19.1 personal-recipe-import' }
    });
    if (!response.ok) throw importError(`GuteKueche hat mit Status ${response.status} geantwortet.`, 502, 'gutekueche_fetch_failed');
    normalizeGuteKuecheUrl(response.url || sourceUrl);
    const type = String(response.headers.get('content-type') || '');
    if (type && !type.includes('text/html') && !type.includes('application/xhtml+xml')) throw importError('Der Link liefert keine Rezeptseite.', 422, 'gutekueche_invalid_content');
    return parseGuteKuecheHtml(await readLimitedHtml(response), sourceUrl);
  } catch (error) {
    if (error?.name === 'AbortError') throw importError('GuteKueche hat nicht rechtzeitig geantwortet.', 504, 'gutekueche_timeout');
    if (error?.status) throw error;
    throw importError('GuteKueche konnte derzeit nicht erreicht werden.', 502, 'gutekueche_unavailable');
  } finally { clearTimeout(timeout); }
}
