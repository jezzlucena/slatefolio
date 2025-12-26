import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import deepmerge from 'deepmerge';
 
export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
 
  const userMessages = (await import(`../../messages/${locale}.json`)).default;
  const fallbackMessages = (await import(`../../messages/en.json`)).default;
  const messages = deepmerge(fallbackMessages, userMessages);
 
  return {
    locale,
    messages
  };
});