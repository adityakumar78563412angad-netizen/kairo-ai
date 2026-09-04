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
  title: {
    default: "Kairo AI — Your Intelligent AI Companion",
    template: "%s | Kairo AI",
  },

  description:
    "Kairo AI is your intelligent AI companion for chatting, creating, learning, brainstorming, writing code, analyzing information, and getting things done.",

  keywords: [
    "Kairo AI",
    "Kairo AI chatbot",
    "Kairo AI assistant",
    "AI assistant",
    "AI chatbot",
  ],

  metadataBase: new URL("https://kairo-ai-alpha.vercel.app"),

  alternates: {
    canonical: "/",
  },

  verification: {
    google: "L1BTfuJSNKz-nvLpgAHLOuKRdvn1grRo16EPq7GTMLQ",
  },

  openGraph: {
    title: "Kairo AI — Your Intelligent AI Companion",
    description:
      "Chat, create, learn, brainstorm, write code, and get things done with Kairo AI.",
    url: "https://kairo-ai-alpha.vercel.app/",
    siteName: "Kairo AI",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "Kairo AI — Your Intelligent AI Companion",
    description:
      "Chat, create, learn, brainstorm, write code, and get things done with Kairo AI.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Kairo AI",
    description:
      "Kairo AI is your intelligent AI companion for chatting, creating, learning, brainstorming, writing code, analyzing information, and getting things done.",
    url: "https://kairo-ai-alpha.vercel.app/",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        {children}
      </body>
    </html>
  );
}