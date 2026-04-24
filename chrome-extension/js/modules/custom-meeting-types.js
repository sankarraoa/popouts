// Custom meeting type management
// Stored in chrome.storage.local (no IndexedDB schema change needed).

import { getAllMeetingSeries, updateMeetingSeries } from '../meetings.js';

const STORAGE_KEY = 'customMeetingTypes';
const ORDER_KEY = 'meetingTypeOrder';

export const BUILT_IN_TYPE_KEYS = ['1:1s', 'interviews', 'recurring', 'adhoc'];

const CUSTOM_TYPE_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f97316', // orange
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#e85d4a', // red
  '#a855f7', // purple
];

export function getCustomTypeKey(id) {
  return `custom_${id}`;
}

export function parseCustomTypeId(typeKey) {
  if (!typeKey || !typeKey.startsWith('custom_')) return null;
  const id = Number(typeKey.replace('custom_', ''));
  return Number.isFinite(id) ? id : null;
}

export function isCustomType(typeKey) {
  return typeof typeKey === 'string' && typeKey.startsWith('custom_');
}

export async function getAllCustomMeetingTypes() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  } catch {
    return [];
  }
}

/** Returns the full ordered list of type keys (built-in + custom). */
export async function getMeetingTypeOrder() {
  try {
    const result = await chrome.storage.local.get([ORDER_KEY, STORAGE_KEY]);
    const stored = Array.isArray(result[ORDER_KEY]) ? result[ORDER_KEY] : null;
    const customTypes = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const allCustomKeys = customTypes.map(ct => getCustomTypeKey(ct.id));

    if (!stored) {
      return [...BUILT_IN_TYPE_KEYS, ...allCustomKeys];
    }

    // Remove stale keys; keep valid ones, append any new custom keys not yet in order
    const validKeys = new Set([...BUILT_IN_TYPE_KEYS, ...allCustomKeys]);
    const cleaned = stored.filter(k => validKeys.has(k));
    const missing = allCustomKeys.filter(k => !cleaned.includes(k));
    return [...cleaned, ...missing];
  } catch {
    const customTypes = await getAllCustomMeetingTypes();
    return [...BUILT_IN_TYPE_KEYS, ...customTypes.map(ct => getCustomTypeKey(ct.id))];
  }
}

/** Persists the given ordered type-key array. */
export async function setMeetingTypeOrder(order) {
  await chrome.storage.local.set({ [ORDER_KEY]: order });
}

export async function createCustomMeetingType(name) {
  const existing = await getAllCustomMeetingTypes();
  const color = CUSTOM_TYPE_COLORS[existing.length % CUSTOM_TYPE_COLORS.length];
  const id = Date.now();
  const newType = {
    id,
    name: name.trim(),
    color,
    createdAt: new Date().toISOString(),
    order: existing.length,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: [...existing, newType] });
  // Append to the end of the global order
  const currentOrder = await getMeetingTypeOrder();
  if (!currentOrder.includes(getCustomTypeKey(id))) {
    await setMeetingTypeOrder([...currentOrder, getCustomTypeKey(id)]);
  }
  return newType;
}

/**
 * Creates a custom type preserving name + color (used during import).
 * Returns the new type object with its freshly assigned ID.
 */
export async function importCustomMeetingType(name, color) {
  const existing = await getAllCustomMeetingTypes();
  const resolvedColor = color || CUSTOM_TYPE_COLORS[existing.length % CUSTOM_TYPE_COLORS.length];
  const id = Date.now();
  const newType = {
    id,
    name: name.trim(),
    color: resolvedColor,
    createdAt: new Date().toISOString(),
    order: existing.length,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: [...existing, newType] });
  const currentOrder = await getMeetingTypeOrder();
  if (!currentOrder.includes(getCustomTypeKey(id))) {
    await setMeetingTypeOrder([...currentOrder, getCustomTypeKey(id)]);
  }
  return newType;
}

export async function deleteCustomMeetingType(id) {
  const typeKey = getCustomTypeKey(id);
  // Move all meetings in this type to Ad Hoc so nothing is lost
  try {
    const allMeetings = await getAllMeetingSeries();
    for (const meeting of allMeetings) {
      if (meeting.type === typeKey) {
        await updateMeetingSeries(meeting.id, { type: 'adhoc' });
      }
    }
  } catch (e) {
    console.warn('Could not migrate meetings when deleting custom type:', e);
  }
  // Remove from type list
  const existing = await getAllCustomMeetingTypes();
  const updated = existing.filter(ct => Number(ct.id) !== Number(id));
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  // Remove from global order
  const currentOrder = await getMeetingTypeOrder();
  await setMeetingTypeOrder(currentOrder.filter(k => k !== typeKey));
}
