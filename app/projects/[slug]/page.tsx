import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CASE_STUDIES, PROJECTS, slugOf } from "@/components/project/projects";
import { StoryBlock } from "@/components/project/story";
import ProjectPageKeys from "@/components/project/ProjectPageKeys";
import { getImageProps } from "next/image";
import LoopVideo from "@/components/media/LoopVideo";
import { LINKEDIN, NAME, SITE } from "@/lib/site";
import "@/components/project/project.css";

/*
 * A project's own page: the same case study as the open view on the home page, laid
 * out the same way, but rendered on the server in full, with its own address, title,
 * description and share image. The open view moves the address bar here, so a shared
 * or bookmarked link lands on this page.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return CASE_STUDIES.map((p) => ({ slug: slugOf(p) }));
}

const find = (slug: string) => PROJECTS.findIndex((p) => slugOf(p) === slug);

/** A description for search results: the summary, cut at a word near 160 characters. */
const clip = (text: string, max = 158) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max))}…`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = PROJECTS[find(slug)];
  if (!project) return {};
  const title = `${project.title} case study | ${NAME}`;
  // The headline carries the most (and the best) words; the summary follows it.
  const headline = (project.headline ?? project.title).replace(/[.\s]+$/, "");
  const description = clip(`${headline}. ${project.summary}`);
  const image = project.video?.poster ?? project.image;
  const url = `/projects/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title, description, siteName: NAME, images: [{ url: image, alt: headline }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = find(slug);
  const project = PROJECTS[index];
  if (!project) notFound();
  const headline = project.headline ?? project.title;
  const url = `${SITE}/projects/${slug}`;
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${url}#work`,
        name: headline,
        headline,
        description: project.summary,
        url,
        image: `${SITE}${project.video?.poster ?? project.image}`,
        ...(project.year ? { dateCreated: project.year } : {}),
        author: { "@type": "Person", name: NAME, url: SITE, sameAs: [LINKEDIN] },
        about: project.kind,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: NAME, item: SITE },
          { "@type": "ListItem", position: 2, name: project.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="pv" data-static="" data-revealed="">
      <div className="pv-scroll">
        <article className="pv-column">
          <div className="pv-hero" data-landed="">
            {project.video ? (
              <LoopVideo src={project.video.src} poster={project.video.poster} label={headline} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...getImageProps({ src: project.image, alt: headline, width: 1020, height: 1000, sizes: "(max-width: 728px) calc(100vw - 48px), 680px", quality: 85, priority: true }).props} />
            )}
          </div>

          <header className="pv-head">
            <p className="pv-reveal">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{project.kind.toLowerCase()}</span>
              {project.year && <span>{project.year}</span>}
            </p>
            <h1 className="pv-reveal">{headline}</h1>
            <p className="pv-reveal pv-summary">{project.summary}</p>
          </header>

          <dl className="pv-reveal pv-details">
            {project.details.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>

          <div className="pv-story">
            {project.story.map((block, i) => (
              <StoryBlock key={i} block={block} />
            ))}
          </div>

          <footer className="pv-reveal pv-foot">
            <a href="/">[close]</a>
            <span>esc</span>
          </footer>
        </article>
      </div>

      <nav className="pv-topbar" aria-label="Back to the portfolio">
        <a href="/">[close]</a>
        <span>esc</span>
      </nav>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      <ProjectPageKeys />
    </div>
  );
}
