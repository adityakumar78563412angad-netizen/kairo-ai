import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kairo AI",
  description: "Kairo AI — Your intelligent AI companion",
  verification: {
    google: "L1BTfuJSNKz-nvLpgAHLOuKRdvn1grRo16EPq7GTMLQ",
  },
};