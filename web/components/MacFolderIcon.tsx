"use client";

import { useId } from "react";

/** A scalable Finder-inspired folder, with layered tab and front-panel artwork. */
export function MacFolderIcon() {
  const id = useId();
  return (
    <svg className="mac-folder-icon" viewBox="0 0 280 200" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#8bd5f1" /><stop offset="1" stopColor="#45add4" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#72ceee" /><stop offset="1" stopColor="#42afd7" />
        </linearGradient>
      </defs>
      <path d="M8 28Q8 10 26 10H91Q102 10 109 18L121 31Q125 35 132 35H254Q272 35 272 53V171Q272 190 253 190H27Q8 190 8 171Z" fill={`url(#${id}-back)`} />
      <path d="M29 43H251Q260 43 260 52V67H20V52Q20 43 29 43Z" fill="#dff5fc" />
      <rect x="8" y="51" width="264" height="139" rx="18" fill={`url(#${id}-front)`} />
      <path d="M27 52H253" stroke="#b7eafa" strokeOpacity=".65" strokeLinecap="round" />
    </svg>
  );
}
