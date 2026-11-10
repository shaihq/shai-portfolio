import type { Frame, Meta } from "ascii.rest";

/*
 * Work experience as an ascii.rest piece, after its "file tree"
 * (https://ascii.rest/file-tree/, ascii.rest by @bas3line, MIT): a listing with a
 * cursor that turns a branch into an arrow and a "+" on closed folders, in the
 * same timings. One folder per company, its role and dates inside.
 *
 * Two changes from the original, for a page: the grid is sized to these lines
 * rather than a fixed 36 × 23, and folders open one at a time (the cursor walks
 * down, each company opens, holds long enough to read, and closes), so the tree
 * stays a few lines tall under the bio instead of the whole list.
 *
 * Pure: the same frame for the same time, on the server or in the browser.
 */

export interface Role {
  company: string;
  title: string;
  from: string;
  to: string;
  length: string;
}

// From LinkedIn, newest first (Damnnnn left out).
export const ROLES: Role[] = [
  { company: "servicenow", title: "staff product designer, ai", from: "mar 2026", to: "sep 2026", length: "7 mos" },
  { company: "sense", title: "staff product designer, ai & new initiatives", from: "jul 2024", to: "mar 2026", length: "1 yr 9 mos" },
  { company: "freshworks", title: "lead product designer, crm (freshsales)", from: "dec 2023", to: "jul 2024", length: "8 mos" },
  { company: "mycaptain", title: "head of design", from: "nov 2022", to: "sep 2023", length: "11 mos" },
  { company: "alfheimr.tech", title: "lead product designer / founder (acquired)", from: "oct 2018", to: "nov 2022", length: "4 yrs 2 mos" },
];

const ROOT = "~/experience";
const MOVE = 0.13; // seconds per line the cursor steps
const PAUSE = 0.3; // on a folder before it opens or closes
const REVEAL = 0.07; // per line appearing or going
const READ = 2.4; // a company held open
const REST = 0.9; // all closed, at the start of each loop

interface Folder {
  name: string;
  kids: string[];
}

const folders: Folder[] = ROLES.map((r) => ({
  name: `${r.company}/`,
  // An en dash, not an arrow: Geist Mono has no arrows, and a glyph from another font
  // is a different width and knocks the grid out of line.
  kids: [r.title, `${r.from} – ${r.to} · ${r.length}`],
}));
const since = ROLES[ROLES.length - 1]!.from.split(" ")[1];
const SUMMARY = `${ROLES.length} companies · since ${since}`;

/** The listing with `open` folder showing `shown` of its lines and the cursor on `cursor`. */
function listing(cursor: number, open: number, shown: number) {
  const lines = [ROOT];
  folders.forEach((f, i) => {
    const last = i === folders.length - 1;
    const closed = i !== open || shown === 0;
    lines.push(`${last ? "└─" : "├─"}${i === cursor ? "> " : "─ "}${f.name}${closed ? " +" : ""}`);
    if (i === open) {
      for (let k = 0; k < shown; k++) lines.push(`${last ? "    " : "│   "}${k === f.kids.length - 1 ? "└── " : "├── "}${f.kids[k]}`);
    }
  });
  return lines;
}

const longest = Math.max(
  SUMMARY.length,
  ...folders.flatMap((f) => [6 + f.name.length + 2, ...f.kids.map((k) => 8 + k.length)]),
);
const tallest = 1 + folders.length + Math.max(...folders.map((f) => f.kids.length));

export const meta: Meta = {
  name: "experience",
  category: "ui",
  note: "work experience as a file tree, opened company by company",
  cols: longest,
  // The listing at its tallest, a blank line, and the summary.
  rows: tallest + 2,
  fps: 15,
  options: {},
  still: 0,
};

export default function experience(): Frame {
  const { cols, rows } = meta;
  const render = (lines: string[]) => {
    const out = [...lines];
    while (out.length < rows - 1) out.push("");
    out.push(SUMMARY);
    return out.map((s) => s.padEnd(cols)).join("\n");
  };

  // The whole loop as a list of pictures and how long each stays up.
  const snaps: { at: number; text: string }[] = [];
  let total = 0;
  const snap = (text: string[], dur: number) => {
    snaps.push({ at: total, text: render(text) });
    total += dur;
  };

  let cursor = 0;
  snap(listing(cursor, -1, 0), REST);
  folders.forEach((f, i) => {
    while (cursor < i) snap(listing(++cursor, -1, 0), MOVE);
    snap(listing(cursor, i, 0), PAUSE);
    for (let k = 1; k <= f.kids.length; k++) snap(listing(cursor, i, k), k === f.kids.length ? READ : REVEAL);
    for (let k = f.kids.length - 1; k >= 0; k--) snap(listing(cursor, i, k), k === 0 ? PAUSE : REVEAL);
  });
  while (cursor > 0) snap(listing(--cursor, -1, 0), MOVE);

  return (t: number) => {
    const p = ((t % total) + total) % total;
    let i = 0;
    while (i + 1 < snaps.length && snaps[i + 1]!.at <= p) i++;
    return snaps[i]!.text;
  };
}

/** The picture before it starts: everything closed, the cursor on the first company. */
export const restFrame = () => experience()(0);
