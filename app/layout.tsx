import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/web3-provider";
import { AppProvider } from "@/components/app-provider";
import { SiteHeader } from "@/components/site-header";
import { LoginModalProvider } from "@/components/login-modal-context";
import { ToastProvider } from "@/components/toast-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PennyArena — Paid by the fraction",
  description: "Micropayment content arena on Arc testnet",
  icons: {
    icon: [{ url: "/brand/pixel_coin.svg", type: "image/svg+xml" }],
    shortcut: "/brand/pixel_coin.svg",
    apple: "/brand/pixel_coin.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Web3Provider>
          <AppProvider>
            <LoginModalProvider>
              <ToastProvider>
                <SiteHeader />
                <main className="mx-auto w-full max-w-[min(100%,88rem)] px-[clamp(1rem,3vw,2rem)] py-6 pb-24">{children}</main>
              </ToastProvider>
            </LoginModalProvider>
          </AppProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
