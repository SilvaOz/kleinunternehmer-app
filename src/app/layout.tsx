import type { Metadata } from "next";
import { DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
  display: "swap",
});

export const viewport = {
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "InvoiceOS",
  description: "Buchhaltung für Kleinunternehmer nach §19 UStG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={dmSerif.variable}>
      <body className="bg-[#0f0f11] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
