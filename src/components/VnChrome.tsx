import { useEffect, useState, type ReactNode } from 'react';

export function CornerBrackets({
  color = 'amber',
}: {
  color?: 'amber' | 'cyan';
}) {
  const borderClass =
    color === 'amber' ? 'border-amber-400/90' : 'border-sky-400/90';
  return (
    <>
      <span
        className={`absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 ${borderClass} pointer-events-none z-10`}
      />
      <span
        className={`absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 ${borderClass} pointer-events-none z-10`}
      />
      <span
        className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 ${borderClass} pointer-events-none z-10`}
      />
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 ${borderClass} pointer-events-none z-10`}
      />
    </>
  );
}

export function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
