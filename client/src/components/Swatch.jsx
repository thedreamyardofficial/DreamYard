import { useId } from "react";

// Menswear cloth swatches drawn as SVG: herringbone ("ikat"), pinstripe ("stripe"), windowpane ("check")
export default function Swatch({ swatch, className = "", children }) {
  const id = "sw" + useId().replace(/\W/g, "");
  const { base, accent, pattern } = swatch;
  const patterns = {
    ikat: (
      <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 16L8 8M0 8L8 0M8 8L16 16M8 0L16 8" stroke={accent} strokeWidth="1.6" opacity=".55" />
      </pattern>
    ),
    stripe: (
      <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="1.2" height="14" fill={accent} opacity=".8" />
      </pattern>
    ),
    check: (
      <pattern id={id} width="44" height="44" patternUnits="userSpaceOnUse">
        <path d="M0 0H44M0 0V44" stroke={accent} strokeWidth="1.2" opacity=".7" />
        <path d="M0 22H44M22 0V44" stroke={accent} strokeWidth=".5" opacity=".4" />
      </pattern>
    ),
  };
  return (
    <div className={`swatch ${className}`} style={{ background: base }} aria-hidden="true">
      <svg width="100%" height="100%">
        <defs>{patterns[pattern] || patterns.stripe}</defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      {children}
    </div>
  );
};
