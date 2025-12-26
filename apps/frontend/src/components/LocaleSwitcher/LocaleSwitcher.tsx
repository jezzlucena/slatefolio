import { useLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import LocaleSwitcherSelect from './LocaleSwitcherSelect';
import { LANGUAGES } from '@/utils/constants';

export default function LocaleSwitcher() {
  const locale = useLocale();

  return (
    <LocaleSwitcherSelect defaultValue={locale}>
      {routing.locales.map((cur) => (
        <option key={cur} value={cur}>
          {LANGUAGES[cur].long}
        </option>
      ))}
    </LocaleSwitcherSelect>
  );
}