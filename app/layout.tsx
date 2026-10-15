import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'FocusFlow — Read with focus',
  description: 'Bionic reading, article insights, adjustable visual pacing, and optional audio rhythm practice.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}