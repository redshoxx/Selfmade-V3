export const uuid = () => crypto.randomUUID?.() || `${Date.now().toString(16)}-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
export const localId = () => `local-${uuid()}`;
