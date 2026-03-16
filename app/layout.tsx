import "./globals.css";
import { ReactNode } from "react";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata = {
  title: "Olgoo",
  description: "Olgoo media platform",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fa">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}