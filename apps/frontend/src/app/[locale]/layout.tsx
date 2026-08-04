import "./globals.css";
import Footer from "../../components/Footer/Footer";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';
import Header from "@/components/Header/Header";
import { LOGO_COOKIE } from "@/components/Header/logoRotation";
import { AuthProvider } from "@/contexts/AuthContext";

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  // Ensure that the incoming `locale` is valid
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Each full page load shows the next logo in the rotation; the cookie is
  // written client-side by Header, so this render stays read-only
  const cookieStore = await cookies();
  const parsed = Number.parseInt(cookieStore.get(LOGO_COOKIE)?.value ?? '0', 10);
  const logoIndex = Number.isNaN(parsed) ? 0 : parsed;

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider>
          <AuthProvider>
            <Header logoIndex={logoIndex} />
            {children}
            <Footer />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
