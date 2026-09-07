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
  metadataBase: new URL("https://zuqen-ai-alpha.vercel.app/"),

  applicationName: "ZUQEN",

  title: {
    default: "ZUQEN — Your Intelligent AI Companion",
    template: "%s | ZUQEN",
  },

  description:
    "ZUQEN is your intelligent AI companion for chatting, coding, creating, and getting things done with AI.",

  keywords: [
    "ZUQEN",
    "ZUQEN AI",
    "ZUQEN AI assistant",
    "ZUQEN chatbot",
    "AI assistant",
    "AI companion",
    "AI chatbot",
    "AI coding assistant",
    "AI website builder",
  ],

  authors: [{ name: "ZUQEN" }],
  creator: "ZUQEN",
  publisher: "ZUQEN",

  alternates: {
    canonical: "https://zuqen-ai-alpha.vercel.app/",
  },

  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },

  openGraph: {
    type: "website",
    url: "https://zuqen-ai-alpha.vercel.app/",
    siteName: "ZUQEN",
    title: "ZUQEN — Your Intelligent AI Companion",
    description:
      "ZUQEN is your intelligent AI companion for chatting, coding, creating, and getting things done with AI.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "ZUQEN",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "ZUQEN — Your Intelligent AI Companion",
    description:
      "ZUQEN is your intelligent AI companion for chatting, coding, creating, and getting things done with AI.",
    images: ["/icon.png"],
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
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ZUQEN",
              alternateName: "ZUQEN AI",
              url: "https://zuqen-ai-alpha.vercel.app/",
            }),
          }}
        />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}