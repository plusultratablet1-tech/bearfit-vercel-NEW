import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BearFit",
    short_name: "BearFit",
    description: "BearFit training, scheduling, packages, and member progress.",
    start_url: "/launch?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#F37020",
    theme_color: "#F37020",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icons/bearfit-orange-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/bearfit-orange-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/bearfit-orange-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
