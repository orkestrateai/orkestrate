import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://orkestrate.space";

  return [{
    url: baseUrl,
    lastModified: "2026-05-27",
    changeFrequency: "monthly" as const,
    priority: 1,
  }];
}
