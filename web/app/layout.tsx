import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Cortex",
  description: "Web viewer for the Cortex — pages, tasks, daily notes, and the op log.",
  manifest: "/manifest.webmanifest",
  // Make "Add to Home Screen" on iOS open full-screen like a native app.
  appleWebApp: {
    capable: true,
    title: "Cortex",
    statusBarStyle: "black-translucent",
  },
  // Belt-and-suspenders: the legacy Apple flag alongside Next's modern
  // `mobile-web-app-capable`, so older iOS also launches full-screen standalone.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#14130d",
  width: "device-width",
  initialScale: 1,
  // let the page paint under the notch / home indicator; we pad with safe-area.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
