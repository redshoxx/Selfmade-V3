const month = new Date().toISOString().slice(0, 7);
const timestamp = new Date().toISOString();

export const INITIAL_BACKUP = {
  version: 3,
  exported_at: timestamp,
  tables: {
    settings: [{
      id: 1,
      display_name: '',
      household_name: '',
      theme: 'light',
      savings: 0,
      selected_month: month,
      updated_at: timestamp
    }],
    members: [],
    budgets: [],
    transactions: [],
    recurring_items: [],
    shopping_items: [],
    pantry_items: [],
    notes: [],
    product_catalog: [],
    purchases: [],
    receipts: [],
    challenge: []
  }
};
