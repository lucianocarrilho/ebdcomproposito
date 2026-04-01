import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EBD com Propósito - Organização a serviço do Reino",
  description: "Sistema completo para gestão da Escola Bíblica Dominical. Controle presença, alunos, classes, lições e muito mais.",
  keywords: "EBD, Escola Bíblica Dominical, gestão, igreja, presença, alunos",
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
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

