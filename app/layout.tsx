import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Film from "@/components/film/Film";
import { DESCRIPTION, EMAIL, GTM_ID, LINKEDIN, NAME, SITE, TITLE } from "@/lib/site";

// Analytics only from the built site, so working on it locally isn't counted as visits.
const ANALYTICS = process.env.NODE_ENV === "production";

// Geist Sans reads (names, sentences, titles); Geist Mono labels (numbers, metadata,
// the file tree). Both self-hosted by next/font, no request to Google at runtime.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

// The share image itself is app/opengraph-image.jpg and app/twitter-image.jpg (1200×630).
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: NAME,
  authors: [{ name: NAME, url: LINKEDIN }],
  creator: NAME,
  keywords: ["Shai Krishna", "Design Engineer", "Product Designer", "Staff Product Designer", "portfolio", "UX", "AI", "interaction design", "creative coding"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    url: "/",
    siteName: NAME,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/favicon/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/favicon/site.webmanifest",
};

export const viewport: Viewport = { themeColor: "#131518" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} data-intro="on">
      <head>
        <noscript>
          <style>{`.intro-overlay{display:none}html[data-intro="on"] .page{opacity:1}html[data-intro] .signature path{stroke-dasharray:none}`}</style>
        </noscript>
      </head>
      <body>
        {ANALYTICS && (
          <>
            {/* Google Tag Manager (it loads Google Analytics), once the page is interactive. */}
            <Script id="gtm" strategy="afterInteractive">
              {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
            </Script>
            <noscript>
              <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" />
            </noscript>
          </>
        )}
        {/* Who this is and what the site is, for search engines. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Person",
                  "@id": `${SITE}/#person`,
                  name: NAME,
                  jobTitle: "Design Engineer",
                  description: DESCRIPTION,
                  url: SITE,
                  image: `${SITE}/opengraph-image.jpg`,
                  email: `mailto:${EMAIL}`,
                  sameAs: [LINKEDIN],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE}/#website`,
                  name: NAME,
                  url: SITE,
                  description: DESCRIPTION,
                  inLanguage: "en",
                  publisher: { "@id": `${SITE}/#person` },
                },
              ],
            }),
          }}
        />
        <Film />
        {children}
      </body>
    </html>
  );
}
