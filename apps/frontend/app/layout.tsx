import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Public_Sans } from "next/font/google";
import "./globals.css";

const brandSans = Public_Sans({
  variable: "--font-brand-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displaySans = Plus_Jakarta_Sans({
  variable: "--font-display-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const opsMono = IBM_Plex_Mono({
  variable: "--font-ops-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "DSEdify Admin Command Center",
  description: "Enterprise batch scheduling admin dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${brandSans.variable} ${displaySans.variable} ${opsMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
