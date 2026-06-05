import { MetadataRoute } from "next";
import { listPublicRegistryItems } from "@/lib/registry/public";

const DOC_PATHS = [
  "/docs",
  "/docs/getting-started/installation",
  "/docs/getting-started/quickstart",
  "/docs/workbench",
  "/docs/concepts",
  "/docs/harnesses/introduction",
  "/docs/harnesses/authoring",
  "/docs/agents/packs",
  "/docs/agents/launch",
  "/docs/registry",
  "/docs/reference/cli",
  "/docs/help/troubleshooting",
  "/docs/help/common-issues",
  "/changelog",
  "/privacy",
  "/security",
  "/resources",
  "/llms.txt",
  "/agents.md",
  "/cli/install.sh",
  "/cli/install.ps1",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://orkestrate.space";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/registry`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/submit`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...DOC_PATHS.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "/docs" ? 0.85 : 0.7,
    })),
  ];

  try {
    const items = await listPublicRegistryItems();
    const dynamicPages = items.map((item) => ({
      url: `${baseUrl}/registry/${item.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));
    return [...staticPages, ...dynamicPages];
  } catch {
    return staticPages;
  }
}