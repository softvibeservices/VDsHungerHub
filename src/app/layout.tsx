import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { FingerprintWarmup } from "@/components/FingerprintWarmup";
import "./globals.css";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ViTa Cuisine – Restaurant & Cloud Kitchen | Fresh Tiffin, Catering & Meal Plans · Thaltej, Ahmedabad",
  description: "ViTa Cuisine is Ahmedabad's premium tiffin & catering service. Corporate meal plans, birthday & party orders, family packs, and bulk catering. Fresh, hygienic, on-time delivery. Think Food, Think Us.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full scroll-smooth`}>
      <body className="min-h-full font-sans">
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
