import type { Metadata, Viewport } from 'next';
import './globals.css';

// Force dynamic rendering to avoid SSR context issues
export const dynamic = 'force-dynamic';

// Font variables are defined in globals.css as fallbacks

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  ),
  title: 'ISOCITY — Metropolis Builder',
  description: 'A luxurious isometric city builder with Art Deco elegance. Zone districts, manage resources, and build your gleaming metropolis.',
  openGraph: {
    title: 'ISOCITY — Metropolis Builder',
    description: 'A luxurious isometric city builder with Art Deco elegance. Zone districts, manage resources, and build your gleaming metropolis.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ISOCITY — Metropolis Builder',
    description: 'A luxurious isometric city builder with Art Deco elegance.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IsoCity',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f1219',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/assets/buildings/residential.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground antialiased font-sans overflow-hidden">{children}</body>
    </html>
  );
}
