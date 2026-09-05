import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = { title: "MedLens | Clinical information intelligence", description: "A traceable, reviewable patient record." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><a className="skip-link" href="#main-content">Skip to content</a>{children}</AuthProvider></body></html>;
}
