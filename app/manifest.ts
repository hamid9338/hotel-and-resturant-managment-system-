import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kashmir View Lodges — Hotel & Management System",
    short_name: "KVL HMS",
    description: "Hotel and restaurant management platform for Kashmir View Lodges.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0f12",
    theme_color: "#0d0f12",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
