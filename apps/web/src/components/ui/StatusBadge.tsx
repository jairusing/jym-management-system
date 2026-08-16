import { type ReactNode } from 'react';

export type StatusTone = 'good' | 'warning' | 'bad' | 'neutral';

const toneClass: Record<StatusTone, string> = {
  good: 'text-[#22C55E]',
  warning: 'text-[#FFB300]',
  bad: 'text-[#FF3D00]',
  neutral: 'text-[#A3A3A3]'
};

type StatusBadgeProps = {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span className={`text-xs uppercase tracking-[0.2em] ${toneClass[tone]} ${className ?? ''}`}>
      {children}
    </span>
  );
}