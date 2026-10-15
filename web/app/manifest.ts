import type { MetadataRoute } from "next";

// Web app manifest — makes the site installable as a standalone app (the
// home-screen "app" experience). iOS uses the apple-icon + apple meta tags;
// Android/Chrome use this manifest. Install icons always use Apple Dark, independent of the selected app theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cortex",
    short_name: "Cortex",
    description: "A second brain for your notes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1c1c1e",
    theme_color: "#1c1c1e",
    icons: [
      { src: "/icons/cortex-apple-dark-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/cortex-apple-dark-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/cortex-apple-dark-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
