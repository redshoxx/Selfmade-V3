import { randomUUID } from 'node:crypto';
import { isoDate, nonNegative, number, text, validDate } from './shared.mjs';

export function receiptFingerprint(storeName, receiptDate, total) {
  return `${text(storeName, 80).toLocaleLowerCase('de-AT')}|${validDate(receiptDate, '')}|${nonNegative(total).toFixed(2)}`;
}

export function parseReceiptText(rawText) {
  const lines = String(rawText || '')
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 1000);

  const moneyPattern = /(-?\d{1,5}[.,]\d{2})\s*(?:€|EUR)?\s*$/i;
  const datePatterns = [
    /\b(\d{2})[.\/-](\d{2})[.\/-](\d{4})\b/,
    /\b(\d{4})-(\d{2})-(\d{2})\b/
  ];
  let storeName = '';
  let receiptDate = '';
  let total = 0;
  const items = [];

  for (const line of lines) {
    if (!storeName && !moneyPattern.test(line) && !/^(bon|beleg|rechnung|kasse|filiale|datum|uid|ust)/i.test(line)) {
      storeName = line.slice(0, 80);
    }
    if (!receiptDate) {
      const first = line.match(datePatterns[0]);
      const second = line.match(datePatterns[1]);
      if (first) receiptDate = `${first[3]}-${first[2]}-${first[1]}`;
      else if (second) receiptDate = `${second[1]}-${second[2]}-${second[3]}`;
    }
    const totalMatch = line.match(/(?:summe|gesamt|total|endbetrag|zu zahlen)\D*(-?\d+[.,]\d{2})/i);
    if (totalMatch) total = Math.max(total, nonNegative(totalMatch[1].replace(',', '.')));

    const priceMatch = line.match(moneyPattern);
    if (!priceMatch) continue;
    let label = line.slice(0, priceMatch.index).replace(/[.·:_-]+$/, '').trim();
    if (!label || /(?:summe|gesamt|total|bar|karte|wechselgeld|mwst|ust|steuer|zu zahlen)/i.test(label)) continue;

    const price = number(priceMatch[1].replace(',', '.'), 0);
    const quantityMatch = label.match(/^(\d+(?:[.,]\d+)?)\s*[xX*]\s*(.+)$/);
    const unitPriceMatch = label.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|stk|stück)\s+(.+)$/i);
    let quantity = '1';
    if (quantityMatch) {
      quantity = quantityMatch[1].replace(',', '.');
      label = quantityMatch[2].trim();
    } else if (unitPriceMatch) {
      quantity = `${unitPriceMatch[1]} ${unitPriceMatch[2]}`;
      label = unitPriceMatch[3].trim();
    }
    const isDiscount = /rabatt|aktion|ersparnis|gutschein/i.test(label) || price < 0;
    const isDeposit = /pfand|mehrweg|einweg/i.test(label);
    items.push(normalizeReceiptItem({
      id: randomUUID(),
      name: label,
      quantity,
      unit_price: Math.abs(price),
      price,
      discount: isDiscount ? Math.abs(price) : 0,
      deposit: isDeposit ? Math.abs(price) : 0,
      category: isDeposit ? 'Pfand' : isDiscount ? 'Rabatt' : 'Lebensmittel'
    }));
  }

  if (!total) {
    total = Number(items.reduce((sum, item) => sum + number(item.price), 0).toFixed(2));
  }
  return {
    store_name: storeName,
    receipt_date: receiptDate || isoDate(),
    total: nonNegative(total),
    items: items.slice(0, 200),
    confidence: items.length ? Math.min(0.95, 0.45 + items.length * 0.03) : 0.15
  };
}

export function normalizeReceiptItem(item) {
  return {
    id: String(item?.id || randomUUID()),
    name: text(item?.name, 120),
    quantity: text(item?.quantity || '1', 30) || '1',
    unit_price: nonNegative(item?.unit_price ?? item?.price),
    price: number(item?.price ?? item?.unit_price, 0),
    discount: nonNegative(item?.discount),
    deposit: nonNegative(item?.deposit),
    category: text(item?.category || 'Lebensmittel', 50) || 'Lebensmittel'
  };
}
