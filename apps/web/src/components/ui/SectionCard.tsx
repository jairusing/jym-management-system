import type { ElementType, ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: ReactNode;
  accent?: boolean;
  titleAs?: 'h2' | 'h3' | 'p';
};

export function SectionCard({
  title,
  eyebrow,
  description,
  children,
  accent = false,
  titleAs = 'p'
}: SectionCardProps) {
  const TitleTag = titleAs as ElementType;
  return (
    <section className={`border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8 ${accent ? 'border-[#FF3D00]' : ''}`}>
      {eyebrow ? <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#FF3D00]">{eyebrow}</p> : null}
      <TitleTag className={`text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3] ${eyebrow ? 'mt-3' : ''}`}>{title}</TitleTag>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#A3A3A3]">{description}</p> : null}
      {children ? <div className="mt-7">{children}</div> : null}
    </section>
  );
}
