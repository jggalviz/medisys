import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

import { DemoHubProvider } from "@/context/DemoHubContext";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://medisys.com.ve"),
  title: "Medisys · Agenda Médica y Expedientes",
  description:
    "Reservas 24/7 y cobros automáticos a tasa BCV, expedientes digitales y perfil SEO para Google. Gratis hasta 30 reservas/mes.",
  keywords: [
    "agenda medica venezuela",
    "expediente medico digital",
    "software medico venezuela",
    "agendamiento citas medicas",
    "pago movil bcv medico",
    "medisys",
  ],
  openGraph: {
    title: "Medisys · Agenda Médica y Expedientes",
    description:
      "Reservas 24/7 y cobros automáticos a tasa BCV, expedientes digitales y perfil SEO para Google. Gratis hasta 30 reservas/mes.",
    url: "https://medisys.com.ve",
    siteName: "Medisys",
    locale: "es_VE",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Medisys - Agenda y Gestión Médica en Venezuela",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Medisys · Agenda Médica y Expedientes",
    description:
      "Reservas 24/7 y cobros automáticos a tasa BCV, expedientes digitales y perfil SEO para Google. Gratis hasta 30 reservas/mes.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DemoHubProvider>{children}</DemoHubProvider>
      </body>
    </html>
  );
}
