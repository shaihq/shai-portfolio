"use client";

import { useEffect } from "react";

/** On a project's own page, Esc goes home, as it closes the open view on the home page. */
export default function ProjectPageKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") location.href = "/";
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return null;
}
