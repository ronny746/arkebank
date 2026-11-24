import { ObjectId } from 'mongodb';

// The questions collection mixes string `_id`s (legacy/TestlyPro imports) with
// ObjectIds (third dataset). Browsers only ever see the string form, so an
// exclusion list must match both representations or ObjectId rows slip through.
export function questionIdVariants(ids: unknown): Array<string | ObjectId> {
  if (!Array.isArray(ids)) return [];
  const variants: Array<string | ObjectId> = [];
  for (const raw of ids) {
    // Only scalar ids are accepted; objects could smuggle Mongo operators.
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const value = String(raw);
    if (!value) continue;
    variants.push(value);
    if (ObjectId.isValid(value) && /^[0-9a-f]{24}$/i.test(value)) variants.push(new ObjectId(value));
  }
  return variants;
}

/**
 * Candidate values of a question's shared EN/HI pairing key (`id`). Legacy
 * banks store it as a number, the third dataset as a string such as
 * "EM0000015"; a client may send either form, so match both.
 */
export function pairingIdCandidates(value: unknown): Array<string | number> {
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0 ? [value] : [];
  if (typeof value !== 'string' || !value.trim()) return [];
  const text = value.trim();
  const numeric = Number(text);
  return Number.isFinite(numeric) && numeric !== 0 ? [text, numeric] : [text];
}
