import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenDesign Studio",
  description:
    "Artifact-first AI design workspace for websites, prototypes, and slides."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
