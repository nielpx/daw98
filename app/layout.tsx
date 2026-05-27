import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAW 98",
  description: "A Windows 98-style Digital Audio Workstation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}