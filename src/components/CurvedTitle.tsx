// Title set on a gently waving arc. The same animation is used by all three leaderboards.
export function CurvedTitle({ id, text }: { id: string; text: string }) {
  const a = "M 20 78 Q 150 14 280 78";
  const b = "M 20 70 Q 150 28 280 70";
  return (
    <svg viewBox="0 0 300 96" className="mx-auto h-auto w-full max-w-[16rem] sm:max-w-[22rem] overflow-visible" role="img" aria-label={text}>
      <defs>
        <path id={`arc-${id}`} d={a}>
          <animate attributeName="d" dur="4s" repeatCount="indefinite" values={`${a};${b};${a}`} calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />
        </path>
      </defs>
      <text
        aria-hidden
        textAnchor="middle"
        className="rb-text"
        style={{ fontSize: 46, strokeLinejoin: "round", stroke: "#000", strokeWidth: 9, paintOrder: "stroke fill", WebkitTextStroke: 0, textShadow: "none" }}
        fill="#fff"
      >
        <textPath href={`#arc-${id}`} startOffset="50%">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
