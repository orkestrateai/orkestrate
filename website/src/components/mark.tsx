type MarkProps = {
  className?: string;
  /** Rounded plate behind mark (header) */
  withPlate?: boolean;
};

const LAYER_PATHS = [
  "M64 18L104 38L64 58L24 38L64 18Z",
  "M64 44L104 64L64 84L24 64L64 44Z",
] as const;

const ACCENT_PATH = "M64 70L104 90L64 110L24 90L64 70Z";

function MarkSvg({ sizeClass }: { sizeClass: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className={`logo-mark ${sizeClass}`}
      aria-hidden
    >
      {LAYER_PATHS.map((d) => (
        <path key={d} d={d} className="logo-mark__layer" />
      ))}
      <path d={ACCENT_PATH} className="logo-mark__accent" />
    </svg>
  );
}

export default function Mark({ className = "h-6 w-6", withPlate = false }: MarkProps) {
  if (!withPlate) {
    return <MarkSvg sizeClass={className} />;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] border border-default bg-card p-1.5 shadow-sm ${className}`}
    >
      <MarkSvg sizeClass="h-5 w-5" />
    </span>
  );
}