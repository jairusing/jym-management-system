import { useEffect, useState } from 'react';

type PageShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  hideNav?: boolean;
};

const navGroups: { label: string; items: { label: string; href: string }[] }[] = [
  {
    label: 'Home',
    items: [{ label: 'Dashboard', href: '/app' }]
  },
  {
    label: 'Management',
    items: [
      { label: 'Members', href: '/app/members' },
      { label: 'Check-ins', href: '/app/checkins' },
      { label: 'Classes', href: '/app/classes' },
      { label: 'Payments', href: '/app/payments' },
      { label: 'Analytics', href: '/app/analytics' },
      { label: 'Exports', href: '/app/exports' },
      { label: 'Staff', href: '/app/staff' },
      { label: 'Activity log', href: '/app/audit' }
    ]
  },
  {
    label: 'Account',
    items: [
      { label: 'My account', href: '/app/my-account' },
      { label: 'My membership', href: '/app/my-membership' },
      { label: 'Profile', href: '/profile' }
    ]
  }
];

function isActive(href: string, path: string) {
  if (href === '/app') {
    return path === '/app';
  }
  return path === href || path.startsWith(`${href}/`);
}

function BrandLink() {
  return (
    <a
      href="/app"
      className="block px-6 py-5 text-xl font-semibold tracking-[-0.04em] text-[#FAFAFA] transition-colors hover:text-[#FF3D00]"
    >
      Jym <span className="text-[#FF3D00]">Management</span>
    </a>
  );
}

function CreditsFooter() {
  return (
    <p className="border-t border-[#262626] px-6 py-4 text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
      © Jairus Co. {new Date().getFullYear()}
    </p>
  );
}

function NavList({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-4 pb-6" aria-label="Primary">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="pb-1 pt-5 text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">{group.label}</p>
          {group.items.map((item) => {
            const active = isActive(item.href, path);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={`whitespace-nowrap border px-4 py-3 text-sm font-medium uppercase tracking-[0.1em] transition-colors lg:border-l-2 lg:border-l-transparent lg:px-4 ${
                  active
                    ? 'border-[#FF3D00] text-[#FF3D00]'
                    : 'border-transparent text-[#A3A3A3] hover:text-[#FAFAFA]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function PageShell({ title, eyebrow, description, children, hideNav = false }: PageShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[#FF3D00] focus:bg-[#0A0A0A] focus:px-4 focus:py-2 focus:text-sm focus:uppercase focus:tracking-[0.1em] focus:text-[#FAFAFA]"
      >
        Skip to content
      </a>

      {hideNav ? null : (
        <>
          <div className="sticky top-0 z-40 border-b border-[#262626] bg-[#0F0F0F] lg:hidden">
            <div className="flex items-center justify-between px-4 py-4">
              <BrandLink />
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                onClick={() => setMenuOpen((current) => !current)}
                className="inline-flex items-center border border-[#262626] px-4 py-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#FAFAFA] transition-colors hover:border-[#FF3D00]"
              >
                Menu
              </button>
            </div>
          </div>

          {menuOpen ? (
            <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          ) : null}

          <aside
            id="mobile-nav"
            aria-hidden={!menuOpen}
            className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-[#262626] bg-[#0F0F0F] transition-transform duration-200 lg:hidden ${
              menuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#262626]">
              <BrandLink />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-2 text-sm uppercase tracking-[0.1em] text-[#A3A3A3] transition-colors hover:text-[#FF3D00]"
              >
                Close
              </button>
            </div>
            <NavList path={path} onNavigate={() => setMenuOpen(false)} />
            <CreditsFooter />
          </aside>

          <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#262626] lg:bg-[#0F0F0F]">
            <BrandLink />
            <div className="flex-1 overflow-y-auto">
              <NavList path={path} />
            </div>
            <CreditsFooter />
          </aside>
        </>
      )}

      <main id="main" className="flex-1 px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <header className="space-y-4 border-b border-[#262626] pb-10">
            {eyebrow ? <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#FF3D00]">{eyebrow}</p> : null}
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl">{title}</h1>
            </div>
            {description ? (
              <p className="max-w-3xl text-base leading-relaxed text-[#A3A3A3] sm:text-lg">{description}</p>
            ) : null}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
