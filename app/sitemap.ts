import type { MetadataRoute } from "next";
import { CASE_STUDIES, slugOf } from "@/components/project/projects";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "monthly", priority: 1 },
    ...CASE_STUDIES.map((p) => ({ url: `${SITE}/projects/${slugOf(p)}`, changeFrequency: "yearly" as const, priority: 0.8 })),
  ];
}
