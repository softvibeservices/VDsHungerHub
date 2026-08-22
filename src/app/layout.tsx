// src\app\layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { FingerprintWarmup } from "@/components/FingerprintWarmup";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ViTa Cuisine – Restaurant & Cloud Kitchen | Fresh Tiffin, Catering & Meal Plans · Thaltej, Ahmedabad",
  description: "ViTa Cuisine is Ahmedabad's premium tiffin & catering service. Corporate meal plans, birthday & party orders, family packs, and bulk catering. Fresh, hygienic, on-time delivery. Think Food, Think Us.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full scroll-smooth`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
      </head>
      <body className="min-h-full font-sans">
        {/* MSG91 OTP Widget JS — loaded lazily, never blocks first paint.
            With exposeMethods: true, this attaches window.sendOTP / window.verifyOTP.
            initSendOTP() is called from VerifyForm / LoginForm / staff-login page
            at the point of OTP send, not here. */}
        <Script
          id="msg91-otp-widget-loader"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
(function loadOtpScript(urls) {
  var i = 0;
  function attempt() {
    var s = document.createElement('script');
    s.src = urls[i]; s.async = true;
    s.onerror = function() { i++; if (i < urls.length) attempt(); };
    document.head.appendChild(s);
  }
  attempt();
})(['https://verify.msg91.com/otp-provider.js','https://verify.phone91.com/otp-provider.js']);
`,
          }}
        />
        <FingerprintWarmup />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#111827",
              color: "#fff",
              fontSize: "14px",
              borderRadius: "8px",
            },
            success: { iconTheme: { primary: "#10B981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#EF4444", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
