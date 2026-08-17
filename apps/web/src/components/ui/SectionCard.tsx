import type { ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: ReactNode;
  accent?: boolean;
};

export function SectionCard({ title, eyebrow, description, children, accent = false }: SectionCardProps) {
  return (
    <section className={`border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8 ${accent ? 'border-[#FF3D00]' : ''}`}>
      {eyebrow ? <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#FF3D00]">{eyebrow}</p> : null}
      <p className={`text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3] ${eyebrow ? 'mt-3' : ''}`}>{title}</p>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#A3A3A3]">{description}</p> : null}
      {children ? <div className="mt-7">{children}</div> : null}
    </section>
  );
}
