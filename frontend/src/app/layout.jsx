import './globals.css';

export const metadata = {
  title: 'ACADIVEX | Smart Campus Management',
  description: 'Smarter Campus. Stronger Futures. Unified Education & Campus Intelligence Platform for students, faculty, and administrators.',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'ACADIVEX | Smart Campus Management',
    description: 'Smarter Campus. Stronger Futures. Enterprise Smart Education & Campus Management Platform.',
    siteName: 'ACADIVEX',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
