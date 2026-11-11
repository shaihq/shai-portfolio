/*
 * Events for Google Analytics, through Google Tag Manager (loaded in app/layout.tsx).
 * Each is pushed to GTM's data layer as { event, ...details }; a GA4 event tag in the
 * container sends it on (a Custom Event trigger per name, or one matching them all).
 *
 *   contact            method: linkedin | resume | email | mentorship
 *   resume_download
 *   resume_open_pdf
 *   case_study_open    project: the case study's address (its slug)
 *   live_project_click project: the product's name
 *
 * Page views need nothing here: GA4 counts the case studies' own addresses as the site
 * changes them (enhanced measurement, "page changes based on browser history events").
 */
export function track(event: string, details: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  (w.dataLayer ??= []).push({ event, ...details });
}
