import type { ReactNode } from 'react';

type ActionLinkProps = {
  label?: string;
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
};

export function ActionLink({ label, href, onClick, children }: ActionLinkProps) {
  const content = (
    <span className="inline-flex items-center gap-2 border-b border-[#FF3D00] pb-1 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px">
      {children ?? label}
    </span>
  );

  if (href) {
    return <a href={href} onClick={onClick} className="inline-flex">{content}</a>;
  }

  return <button type="button" onClick={onClick} className="inline-flex">{content}</button>;
}
