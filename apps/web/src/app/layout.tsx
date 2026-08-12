import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

/*
  Three roles, deliberately.

  Bricolage Grotesque carries headings — it has enough character to be
  recognisable without being a novelty. Plex Sans is the workhorse. Plex Mono
  is not decoration: room numbers, bed codes and rupee figures are read as
  figures, and a monospace face is how buildings and ledgers actually set them.
*/
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PG Platform',
    template: '%s · PG Platform',
  },
  description: 'Find and manage PG and hostel accommodation in Hyderabad.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0a121c' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the saved choice on the server and stamp it on <html>, so the first
  // paint is already the right theme. Doing this in a client effect is what
  // makes apps flash white on load.
  const theme = (await cookies()).get('pg_theme')?.value;
  const explicit = theme === 'dark' || theme === 'light' ? theme : undefined;

  return (
    <html
      lang="en-IN"
      {...(explicit ? { 'data-theme': explicit } : {})}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      style={
        {
          '--font-display': `var(--font-display-loaded), ui-sans-serif, system-ui, sans-serif`,
          '--font-sans': `var(--font-sans-loaded), ui-sans-serif, system-ui, sans-serif`,
          '--font-mono': `var(--font-mono-loaded), ui-monospace, monospace`,
        } as React.CSSProperties
      }
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brass-600 focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
