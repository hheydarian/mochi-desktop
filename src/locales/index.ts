import { fa } from './fa';
import { en } from './en';
import { useMochiStore } from '../store/useMochiStore';

export const translations = { fa, en };
export type { TranslationSchema } from './fa';

export function useTranslation() {
  const lang = useMochiStore((state) => state.lang);
  const t = translations[lang] || translations.fa;
  return { t, lang };
}
