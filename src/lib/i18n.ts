import en from '@/locales/en.json';

// Minimal locale layer required by docs/coding-standards.md#i18n. Only strings
// added or changed after this file was introduced go through it; migrating the
// legacy literals is a separate task.
type LocaleKey = keyof typeof en;

export function t(key: LocaleKey, vars: Record<string, string | number> = {}): string {
  const template: string = en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
