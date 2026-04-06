/**
 * EduVerse Logo SVG Component
 * Galaxy/universe spiral shape with orbital patterns and bright center
 */

interface EduVerseLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function EduVerseLogo({ size = 28, className = '', showText = true }: EduVerseLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ev-logo-grad" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#7B2FFF" />
          </linearGradient>
        </defs>
        {/* Central star */}
        <circle cx="16" cy="16" r="3.5" fill="url(#ev-logo-grad)" />
        <circle cx="16" cy="16" r="2" fill="white" opacity="0.6" />
        {/* Orbital rings */}
        <ellipse
          cx="16" cy="16" rx="8" ry="14"
          fill="none" stroke="url(#ev-logo-grad)" strokeWidth="1.3"
          opacity="0.7" transform="rotate(-30 16 16)"
        />
        <ellipse
          cx="16" cy="16" rx="8" ry="14"
          fill="none" stroke="url(#ev-logo-grad)" strokeWidth="1"
          opacity="0.5" transform="rotate(30 16 16)"
        />
        <ellipse
          cx="16" cy="16" rx="14" ry="6"
          fill="none" stroke="url(#ev-logo-grad)" strokeWidth="0.8"
          opacity="0.3"
        />
        {/* Small orbiting dots */}
        <circle cx="6" cy="8" r="1" fill="#00D4FF" opacity="0.6" />
        <circle cx="26" cy="24" r="0.8" fill="#7B2FFF" opacity="0.5" />
        <circle cx="24" cy="6" r="0.6" fill="#FF6B35" opacity="0.4" />
      </svg>
      {showText && (
        <span
          className="font-semibold text-lg tracking-tight"
          style={{
            fontFamily: 'var(--font-heading)',
            background: 'linear-gradient(135deg, #00D4FF, #7B2FFF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          EduVerse
        </span>
      )}
    </div>
  );
}
