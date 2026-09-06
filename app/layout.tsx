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
  applicationName: "ZUQEN AI",
icons: {
  icon: "/icon.png",
  apple: "/icon.png",
},
  title: {
    default: "ZUQEN AI — Your Intelligent AI Companion",
    template: "%s | ZUQEN AI",
  },

  description:
    "ZUQEN AI is your intelligent AI companion for chatting, creating, learning, brainstorming, writing code, analyzing information, and getting things done.",

  keywords: [
    "ZUQEN AI",
    "ZUQEN AI chatbot",
    "ZUQEN AI assistant",
    "AI assistant",
    "AI chatbot",
  ],

  metadataBase: new URL("https://ZUQEN-ai-alpha.vercel.app"),

  alternates: {
    canonical: "/",
  },

  verification: {
    google: "L1BTfuJSNKz-nvLpgAHLOuKRdvn1grRo16EPq7GTMLQ",
  },

  openGraph: {
    title: "ZUQEN AI — Your Intelligent AI Companion",
    description:
      "Chat, create, learn, brainstorm, write code, and get things done with ZUQEN AI.",
    url: "https://ZUQEN-ai-alpha.vercel.app/",
    siteName: "ZUQEN AI",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "ZUQEN AI — Your Intelligent AI Companion",
    description:
      "Chat, create, learn, brainstorm, write code, and get things done with ZUQEN AI.",
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
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://ZUQEN-ai-alpha.vercel.app/#website",
        name: "ZUQEN AI",
        alternateName: "ZUQEN AI",
        url: "https://ZUQEN-ai-alpha.vercel.app/",
      },
      {
        "@type": "WebApplication",
        "@id": "https://ZUQEN-ai-alpha.vercel.app/#app",
        name: "ZUQEN AI",
        description:
          "ZUQEN AI is your intelligent AI companion for chatting, creating, learning, brainstorming, writing code, analyzing information, and getting things done.",
        url: "https://ZUQEN-ai-alpha.vercel.app/",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
      },
    ],
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