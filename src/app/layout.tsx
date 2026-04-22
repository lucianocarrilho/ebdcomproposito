import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EBD com Propósito - Organização a serviço do Reino",
  description: "Sistema completo para gestão da Escola Bíblica Dominical. Controle presença, alunos, classes, lições e muito mais.",
  keywords: "EBD, Escola Bíblica Dominical, gestão, igreja, presença, alunos",
  icons: {
    icon: '/icons/icon-192x192.png',
    shortcut: '/icons/icon-96x96.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: "EBD com Propósito - Organização a serviço do Reino",
    description: "Sistema completo para gestão da EBD. Controle presença, alunos, lições e muito mais.",
    images: [{ url: '/logo_ebd.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "EBD com Propósito - Organização a serviço do Reino",
    description: "Sistema completo para gestão da EBD.",
    images: ['/logo_ebd.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#16a34a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EBD" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('SW registrado:', reg.scope);
                  }).catch(function(err) {
                    console.log('SW erro:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

