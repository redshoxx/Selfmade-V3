export const APP_VERSION = '3.2.0'

export const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: '▦' },
  { id: 'fruit', name: 'Obst', icon: 'O' },
  { id: 'vegetables', name: 'Gemüse', icon: 'G' },
  { id: 'dairy', name: 'Milchprodukte', icon: 'M' },
  { id: 'bakery', name: 'Backwaren', icon: 'B' },
  { id: 'meat', name: 'Fleisch & Fisch', icon: 'F' },
  { id: 'frozen', name: 'Tiefkühl', icon: 'T' },
  { id: 'pantry', name: 'Vorrat', icon: 'V' },
  { id: 'drinks', name: 'Getränke', icon: 'D' },
  { id: 'snacks', name: 'Snacks', icon: 'S' },
  { id: 'drugstore', name: 'Drogerie', icon: 'R' },
  { id: 'household', name: 'Haushalt', icon: 'H' },
  { id: 'pets', name: 'Tierbedarf', icon: 'P' },
  { id: 'other', name: 'Sonstiges', icon: '·' }
]

const RAW_CATEGORY_RULES = [['household', /\bküchenrolle\w*\b/i]]
const CATEGORY_RULES = [
  ['frozen', /\b(tk|tiefkuhl\w*|tiefgefrier\w*|eiscreme\w*|speiseeis\w*|frozen)\b|tiefkuhlpizza|tiefkuhlgemuse|tiefkuhlbeeren/i],
  ['drinks', /\b(wasser|mineralwasser|saft|nektar|cola|limonade|limo|kaffee|espresso|cappuccino|tee|energy|sirup|bier|wein|sekt|prosecco|getrank\w*)\b|apfelsaft|orangensaft|multivitaminsaft|eistee/i],
  ['dairy', /\b(\w*milch\w*|kase\w*|jogh?urt\w*|butter\w*|sahne\w*|obers\w*|topfen\w*|quark\w*|mozzarella\w*|feta\w*|parmesan\w*|frischkase\w*|pudding\w*|kefir\w*|eier?\w*)\b/i],
  ['bakery', /\b(brot\w*|semmel\w*|brotchen\w*|baguette\w*|toast\w*|croissant\w*|geback\w*|kuchen\w*|torte\w*|muffin\w*|backware\w*)\b/i],
  ['meat', /\b(fleisch\w*|huhn\w*|hahnchen\w*|pute\w*|truthahn\w*|rind\w*|schwein\w*|wurst\w*|schinken\w*|speck\w*|fisch\w*|lachs\w*|thunfisch\w*|forelle\w*|garnel\w*|hack\w*|faschiert\w*|schnitzel\w*|steak\w*)\b/i],
  ['pantry', /\b(nudel\w*|pasta\w*|spaghetti\w*|penne\w*|fusilli\w*|reis\w*|mehl\w*|zucker\w*|salz\w*|pfeffer\w*|gewurz\w*|olivenol\w*|sonnenblumenol\w*|essig\w*|konserve\w*|dose\w*|bohne\w*|linsen\w*|kichererbse\w*|mais\w*|tomatenmark\w*|passata\w*|sauce\w*|bruh\w*|cornflakes\w*|muesli\w*|haferflock\w*)\b/i],
  ['snacks', /\b(chips\w*|schokolade\w*|keks\w*|snack\w*|nuss\w*|nusse\w*|gummibar\w*|popcorn\w*|cracker\w*|bonbon\w*|praline\w*|riegel\w*)\b/i],
  ['drugstore', /\b(shampoo\w*|duschgel\w*|zahnpasta\w*|zahnburste\w*|deo\w*|creme\w*|bodylotion\w*|rasierer\w*|rasier\w*|tampon\w*|binde\w*|windel\w*|kosmetik\w*|makeup\w*|parfum\w*)\b/i],
  ['household', /\b(spulmittel\w*|waschmittel\w*|weichspuler\w*|reiniger\w*|putzmittel\w*|kuchenrolle\w*|toilettenpapier\w*|klopapier\w*|mullbeutel\w*|schwamm\w*|seife\w*|geschirrspul\w*|spultab\w*|alufolie\w*|frischhaltefolie\w*|backpapier\w*|batterie\w*)\b/i],
  ['pets', /\b(katzenfutter\w*|hundefutter\w*|tierfutter\w*|katzenstreu\w*|leckerl\w*|hunde\w*snack\w*|katzen\w*snack\w*)\b/i],
  ['fruit', /\b(apfel\w*|banan\w*|birn\w*|orange\w*|zitrone\w*|limette\w*|traub\w*|erdbeer\w*|heidelbeer\w*|himbeer\w*|brombeer\w*|kiwi\w*|mango\w*|ananas\w*|pfirsich\w*|nektarin\w*|melone\w*|kirsche\w*|zwetsch\w*|pflaume\w*|avocado\w*)\b/i],
  ['vegetables', /\b(tomate\w*|gurke\w*|karotte\w*|mohre\w*|kartoffel\w*|zwiebel\w*|paprika\w*|salat\w*|brokkoli\w*|blumenkohl\w*|zucchini\w*|kurbis\w*|knoblauch\w*|spinat\w*|sellerie\w*|lauch\w*|radies\w*|champignon\w*|pilz\w*)\b/i]
]
export function uid(prefix='id'){ if(globalThis.crypto&&globalThis.crypto.randomUUID)return `${prefix}_${globalThis.crypto.randomUUID()}`; return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}` }
export function normalizeProductName(name=''){return String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml|cl|stk|stuck|pack|pkg|%)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
export function autoCategory(name=''){const raw=String(name).trim();if(!raw)return'other';for(const[c,r]of RAW_CATEGORY_RULES)if(r.test(raw))return c;const text=normalizeProductName(raw);for(const[c,r]of CATEGORY_RULES)if(r.test(text))return c;return'other'}
export function categoryById(id){return CATEGORIES.find(c=>c.id===id)||CATEGORIES[CATEGORIES.length-1]}
export function createInitialState(){const listId=uid('list');return{version:APP_VERSION,lists:[{id:listId,name:'Meine Liste',createdAt:Date.now()}],activeListId:listId,items:[],settings:{theme:'light',onboarded:false,compact:false}}}
export function normalizeState(raw){const fallback=createInitialState();if(!raw||typeof raw!=='object')return fallback;const lists=Array.isArray(raw.lists)&&raw.lists.length?raw.lists.filter(l=>l&&l.id&&l.name).map(l=>({id:String(l.id),name:String(l.name).slice(0,40),createdAt:Number(l.createdAt)||Date.now()})):fallback.lists;const activeListId=lists.some(l=>l.id===raw.activeListId)?raw.activeListId:lists[0].id;const items=Array.isArray(raw.items)?raw.items.filter(i=>i&&i.id&&lists.some(l=>l.id===i.listId)).map(normalizeItem):[];const theme=['dark','light','system'].includes(raw.settings?.theme)?raw.settings.theme:'light';return{version:APP_VERSION,lists,activeListId,items,settings:{theme,onboarded:Boolean(raw.settings?.onboarded),compact:Boolean(raw.settings?.compact)}}}
export function normalizeItem(item={}){const name=String(item.name||'').trim().slice(0,80);const category=CATEGORIES.some(c=>c.id===item.category&&c.id!=='all')?item.category:autoCategory(name);return{id:String(item.id||uid('item')),listId:String(item.listId||''),name,category,quantity:Math.max(.01,Number(item.quantity)||1),unit:String(item.unit||'Stk.').slice(0,12),note:String(item.note||'').trim().slice(0,160),done:Boolean(item.done),favorite:Boolean(item.favorite),createdAt:Number(item.createdAt)||Date.now(),updatedAt:Number(item.updatedAt)||Date.now(),completedAt:item.completedAt?Number(item.completedAt):null}}
export function listItems(state,listId=state.activeListId){return state.items.filter(i=>i.listId===listId)}
export function progressFor(items=[]){if(!items.length)return{total:0,done:0,open:0,percent:0};const done=items.filter(i=>i.done).length;return{total:items.length,done,open:items.length-done,percent:Math.round(done/items.length*100)}}
export function sortItems(items=[]){return[...items].sort((a,b)=>{if(a.done!==b.done)return Number(a.done)-Number(b.done);if(a.category!==b.category)return CATEGORIES.findIndex(c=>c.id===a.category)-CATEGORIES.findIndex(c=>c.id===b.category);return b.updatedAt-a.updatedAt})}
export function frequentSuggestions(state,listId=state.activeListId,limit=6){const counts=new Map();for(const item of state.items){if(item.listId!==listId&&!item.favorite)continue;const key=item.name.trim().toLocaleLowerCase('de');if(!key)continue;const c=counts.get(key)||{name:item.name,count:0,last:0,favorite:false,category:item.category};c.count++;c.last=Math.max(c.last,item.updatedAt);c.favorite=c.favorite||item.favorite;counts.set(key,c)}return[...counts.values()].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.count-a.count||b.last-a.last).slice(0,limit)}
export function categoryCounts(items=[]){const map=Object.fromEntries(CATEGORIES.filter(c=>c.id!=='all').map(c=>[c.id,0]));for(const item of items)map[item.category]=(map[item.category]||0)+1;return map}
export function weeklyStats(items=[],now=Date.now()){const dayMs=86400000,start=new Date(now);start.setHours(0,0,0,0);const days=[];for(let o=6;o>=0;o--){const d=new Date(start.getTime()-o*dayMs),s=d.getTime(),e=s+dayMs,count=items.filter(i=>i.completedAt&&i.completedAt>=s&&i.completedAt<e).length;days.push({date:s,label:new Intl.DateTimeFormat('de-AT',{weekday:'short'}).format(d).slice(0,2),count})}return days}
export function topCategories(items=[],limit=3){const counts=categoryCounts(items.filter(i=>i.done||i.completedAt));return Object.entries(counts).map(([id,count])=>({id,count,...categoryById(id)})).filter(e=>e.count>0).sort((a,b)=>b.count-a.count).slice(0,limit)}
