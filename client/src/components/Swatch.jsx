// Decorative CSS fabric swatch (used in the hero and section tiles)
export default function Swatch({ swatch, className = "", children }) {
  return (
    <div className={`swatch swatch--${swatch.pattern} ${className}`} style={{ "--c": swatch.base, "--c2": swatch.accent }} aria-hidden="true">
      {children}
    </div>
  );
}
