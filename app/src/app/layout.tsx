import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "ProxPanel",
  description: "Panel d'hébergement VPS Proxmox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className="dark font-sans"
        suppressHydrationWarning
      >
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "hsl(240 18% 7%)",
              border: "1px solid hsl(240 12% 16%)",
              color: "hsl(240 5% 95%)",
            },
          }}
        />
      </body>
    </html>
  );
}
