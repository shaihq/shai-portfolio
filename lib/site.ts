/** The site's own address, for absolute URLs (share previews, sitemap, structured data).
 *  Set NEXT_PUBLIC_SITE_URL to the live domain; on Vercel the production domain is used. */
export const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const NAME = "Shai Krishna";
export const TITLE = "Shai Krishna | Design Engineer";
export const DESCRIPTION =
  "Shai here! I'm a Design Engineer who designs products, writes code, and builds things with AI just because I can. Explore my projects, experiments, and interactive experiences.";
export const LINKEDIN = "https://www.linkedin.com/in/shaiii/";
export const EMAIL = "heyfromshai@gmail.com";
export const MENTORSHIP = "https://topmate.io/shai";
/** The resume: the PDF, and its page drawn as a picture for the resume window (Resume.tsx). */
export const RESUME = {
  pdf: "/resume/shai-resume.pdf",
  image: "/resume/shai-resume.png",
  width: 3600,
  height: 4659,
  /** The page's one link (its portfolio link), as fractions of the page. */
  link: { href: "https://shai-portfolio-eta.vercel.app/", left: 0.051, top: 0.0973, width: 0.1725, height: 0.0224 },
};
