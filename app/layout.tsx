import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LaunchWake — distribution co-pilot for founders",
  description:
    "For every ship, LaunchWake tells you where to post it, how to do it without getting banned, and what actually drove signups.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body>{children}</body>
    </html>
  );
}
