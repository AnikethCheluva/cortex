import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Cortex",
  description: "A second brain for your notes.",
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

// Apply the saved theme before first paint, so switching away from the default
// doesn't flash the default palette on every load. Mirrors lib/settings.ts.
const THEME_BOOT = `(function(){try{var s=localStorage.getItem('cortex:settings');if(!s)return;var t=JSON.parse(s).theme;if(t&&t!=='notebook')document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
