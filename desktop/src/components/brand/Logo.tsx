interface LogoProps {
  className?: string;
  withText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className = '', withText = true, size = 'md' }: LogoProps) {
  const containerSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  return (
    <div className={`flex items-center gap-3 md:gap-3 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={`flex-shrink-0 ${containerSizes[size]}`}
      >
        {/* Layer 3 (Bottom) */}
        <path d="M24 42L4 32L24 22L44 32Z" className="stroke-foreground/20" strokeWidth="2" strokeLinejoin="round" />
        {/* Layer 2 (Middle) */}
        <path d="M24 34L4 24L24 14L44 24Z" className="stroke-foreground/40" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 34L4 24L24 14L44 24Z" className="fill-foreground/5" />
        {/* Layer 1 (Top) */}
        <path d="M24 26L4 16L24 6L44 16Z" className="stroke-foreground" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 26L4 16L24 6L44 16Z" className="fill-foreground/10" />
      </svg>

      {withText && (
        <span className={`font-sans font-medium tracking-tight text-foreground ${textSizes[size]}`}>
          Orkestrate
        </span>
      )}
    </div>
  );
}
