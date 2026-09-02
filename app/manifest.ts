import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BearFitPH",
    short_name: "BearFitPH",
    description: "Coach-guided, science-based training.",
    start_url: "/welcome",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#F37120",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
