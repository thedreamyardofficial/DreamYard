// Dream Yard logo: custom geometric letterforms drawn as vector paths (no font needed).
const ITEMS = [["M3,3V57H23A27,27 0 0 0 23,3Z", 0], ["M3,57V3H22A14,14 0 0 1 22,31H3M22,31L40,57", 66], ["M38,3H3V57H38M3,30H32", 124], ["M2,57L24,3L46,57M11,38H37", 178], ["M3,57V3L25,38L47,3V57", 242], ["M2,3L24,32L46,3M24,32V57", 338], ["M2,57L24,3L46,57M11,38H37", 402], ["M3,57V3H22A14,14 0 0 1 22,31H3M22,31L40,57", 466], ["M47,3V57H27A27,27 0 0 1 27,3Z", 524]];
const WORD_W = 576;
const MARK = { d: "M12,8V92H44A42,42 0 0 0 44,8Z", inner: "M19,15V85H44A35,35 0 0 0 44,15Z", y: "M36,34L50,54L64,34M50,54V76" };

export default function Logo({ variant = "full", draw = false, className = "", title = "Dream Yard" }) {
  const p = (extra = {}) => (draw ? { pathLength: 1, className: "draw", ...extra } : extra);
  const mark = (
    <g>
      <path d={MARK.d} fill="none" stroke="currentColor" strokeWidth="4" {...p({ style: { "--i": 0 } })} />
      <path d={MARK.inner} fill="none" stroke="var(--brass, #c2a068)" strokeWidth="1.4" strokeDasharray="3 3" />
      <path d={MARK.y} fill="none" stroke="var(--brass, #c2a068)" strokeWidth="5" {...p({ style: { "--i": 1 } })} />
    </g>
  );
  const word = (
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="miter">
      {ITEMS.map(([d, x], i) => <path key={i} d={d} transform={`translate(${x} 0)`} {...p({ style: { "--i": i + 2 } })} />)}
    </g>
  );
  const vb = variant === "mark" ? "0 0 100 100" : variant === "word" ? `-3 -3 ${WORD_W + 6} 66` : `-4 0 ${128 + WORD_W + 8} 100`;
  return (
    <svg className={`logo logo--${variant} ${className}`} viewBox={vb} role="img" aria-label={title}>
      {variant !== "word" && mark}
      {variant === "word" ? word : variant === "full" ? <g transform="translate(128 20)">{word}</g> : null}
    </svg>
  );
}
