// Inline SVG icon set (no emoji, no external assets).
const P = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round", strokeLinejoin: "round",
} as const;

function I({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" {...P} aria-hidden="true">
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const icons = {
  dashboard: <I d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" />,
  pen: <I d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />,
  bank: (
    <I>
      <path d="M3 9l9-6 9 6M4 9v10M20 9v10M8 12v5M12 12v5M16 12v5M2 21h20" />
    </I>
  ),
  trophy: (
    <I>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a1 1 0 00-1 1c0 2.5 2 4 4 4M17 6h3a1 1 0 011 1c0 2.5-2 4-4 4" />
    </I>
  ),
  chart: (
    <I>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </I>
  ),
  bell: <I d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 21a2 2 0 003.4 0" />,
  shield: <I d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />,
  user: <I d="M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z" />,
  bolt: <I d="M13 2L3 14h7l-1 8 10-12h-7z" />,
  doc: (
    <I>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6" />
    </I>
  ),
  check: <I d="M20 6L9 17l-5-5" />,
  clock: (
    <I>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </I>
  ),
};
