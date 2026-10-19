import type { Metadata } from "next";
import localFont from "next/font/local";
import { CurrentUserAccessProvider } from "@/components/layout/current-user-access-provider";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import "./globals.css";

const manrope = localFont({
  src: "./fonts/manrope/Manrope-VariableFont_wght.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tour Guide Operations",
  description: "Internal dashboard for tour guide operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <CurrentUserAccessProvider>{children}</CurrentUserAccessProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
