import { Fragment } from "react";
import Image, { getImageProps } from "next/image";
import Intro from "@/components/intro/Intro";
import { buildMacintosh } from "@/components/intro/macintosh";
import Stage from "@/components/stage/Stage";
import Mascot from "@/components/mascot/Mascot";
import Experience from "@/components/experience/Experience";
import ProjectView from "@/components/project/ProjectView";
import { PROJECTS, slugOf } from "@/components/project/projects";
import LoopVideo from "@/components/media/LoopVideo";

const macintosh = buildMacintosh();

function Signature() {
  return (
    <svg
      className="signature"
      viewBox="80 20 1240 330"
      fill="none"
      stroke="currentColor"
      strokeWidth="13"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* "Krish", in the order it is written: K stem, then the K arm running on into "rish" and the tail. */}
      <path d="M300 40 C285 135 250 235 215 330" />
      <path d="M560 45 C470 85 360 140 278 172 C338 190 395 225 432 258 C447 272 462 258 472 238 C484 213 492 190 507 178 C520 168 530 180 540 186 C552 192 567 186 580 178 C588 198 592 220 606 218 C620 216 630 196 638 180 C644 168 660 164 668 172 C678 183 664 202 648 212 C672 214 696 204 714 190 C752 150 795 85 820 44 C832 24 816 18 802 38 C780 75 762 150 748 222 C764 196 784 174 804 174 C822 174 820 200 828 216 C834 228 854 222 872 208 C960 175 1100 168 1300 175" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="pill-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20l1.2-4.3L15.6 5.3a2.1 2.1 0 0 1 3 3L8.3 18.8 4 20Z" />
      <path d="M13.6 7.3l3 3" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="pill-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 7 3.5 12l5 5" />
      <path d="m15.5 7 5 5-5 5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="pill-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="var(--text-strong)" d="M10 3c.7 4.4 2.6 6.3 7 7-4.4.7-6.3 2.6-7 7-.7-4.4-2.6-6.3-7-7 4.4-.7 6.3-2.6 7-7Z" />
      <path fill="var(--text-strong)" fillOpacity="0.75" d="M18 14c.35 2.1 1.15 2.9 3.25 3.25-2.1.35-2.9 1.15-3.25 3.25-.35-2.1-1.15-2.9-3.25-3.25 2.1-.35 2.9-1.15 3.25-3.25Z" />
    </svg>
  );
}

/** A chip in the bio: a link when it goes somewhere, plain text when it doesn't. */
function Pill({ href, icon, children }: { href?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const Tag = href ? "a" : "span";
  return (
    <Tag className="pill" href={href}>
      {icon}
      {children}
    </Tag>
  );
}


export default function Home() {
  // Keys on the element props' roots: see the large-payload note in Anatomy's references/react.md.
  const intro = (
    <section key="intro" className="intro">
      <Signature />

      <header className="header">
        <Mascot />
        <div>
          <h1 className="name">Shai Krishna</h1>
          {/* When it wraps (phones), it breaks after the ampersand, not inside a title. */}
          <p className="tagline">
            Staff Product Designer &amp; <span className="nowrap">Design Engineer</span>
          </p>
        </div>
      </header>

      <p className="bio">
        I <Pill icon={<PenIcon />}>design products</Pill>, <Pill icon={<CodeIcon />}>write code</Pill>, and occasionally
        build things with <Pill icon={<SparkIcon />}>AI</Pill> that nobody asked for.
      </p>

      <Experience />
    </section>
  );

  const cards = (
    <Fragment key="cards">
      {PROJECTS.map((project, i) => (
        <a
          key={project.title}
          className="card"
          // A live product's card goes straight to it (motion.ts lets the link be a link).
          {...(project.href ? { href: project.href, target: "_blank", rel: "noopener", "data-external": "" } : { href: `/projects/${slugOf(project)}` })}
          data-card
          draggable={false}
          style={{ "--i": i } as React.CSSProperties}
        >
          <span className="card-body">
          {project.eyebrow && <span className="card-eyebrow">{project.eyebrow}</span>}
          <span className="card-media">
            {project.video ? (
              <LoopVideo src={project.video.src} poster={project.video.poster} label={project.title} />
            ) : (
              <Image src={project.image} alt={project.title} width={1020} height={1000} sizes="(max-width: 600px) calc(100vw - 32px), 560px" quality={85} draggable={false} loading="eager" data-mini="image" />
            )}
          </span>
          {/* The floor under the card: its contact shadow and a faint reflection. */}
          <span className="card-floor" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* A faint, blurred reflection: a small copy is plenty. */}
            <img className="card-reflection" src={getImageProps({ src: project.image, alt: "", width: 640, height: 627, quality: 60 }).props.src} alt="" draggable={false} loading="lazy" decoding="async" />
          </span>
          <span className="card-meta">
            <span className="card-title" data-mini="text">
              {project.title}
            </span>
            <span className="card-kind" data-mini="text">
              {project.kind}
              {/* Leaves the site: the LinkedIn key's arrow (Geist Mono has no ↗ of its own). */}
              {project.href && (
                <svg className="card-out" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7" />
                  <path d="M8.5 7H17v8.5" />
                </svg>
              )}
            </span>
          </span>
          </span>
        </a>
      ))}
    </Fragment>
  );

  return (
    <>
      <Intro markup={macintosh.svg} screen={macintosh.screen} />
      <Stage intro={intro} cards={cards} />
      <ProjectView />
    </>
  );
}
