export const inputClass =
  'border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]';

export const primaryButtonClass =
  'relative inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-colors duration-150 hover:text-[#FF3D00] active:translate-y-px disabled:opacity-50 focus-visible:text-[#FF3D00] focus-visible:ring-2 focus-visible:ring-[#FF3D00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] focus-visible:after:scale-x-110 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:bg-[#FF3D00] after:transition-transform after:duration-150 hover:after:scale-x-110';

export const outlineButtonClass =
  'inline-flex items-center gap-2 border border-[#FAFAFA] px-6 py-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#FAFAFA] transition-colors duration-150 hover:bg-[#FAFAFA] hover:text-[#0A0A0A] active:translate-y-px disabled:opacity-50 focus-visible:bg-[#FAFAFA] focus-visible:text-[#0A0A0A] focus-visible:ring-2 focus-visible:ring-[#FF3D00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]';

export const ghostButtonClass =
  'relative inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#A3A3A3] transition-colors duration-150 hover:text-[#FAFAFA] active:translate-y-px disabled:opacity-50 focus-visible:text-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-[#FF3D00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] focus-visible:after:scale-x-100 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-150 hover:after:scale-x-100';

export const dangerButtonClass =
  'relative inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-colors duration-150 hover:text-[#FF3D00] active:translate-y-px disabled:opacity-50 focus-visible:text-[#FF3D00] focus-visible:ring-2 focus-visible:ring-[#FF3D00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] focus-visible:after:scale-x-100 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-150 hover:after:scale-x-100';

export const chipClass = (selected: boolean) =>
  `border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150 ${
    selected ? 'border-[#FF3D00] text-[#FF3D00]' : 'border-[#262626] text-[#A3A3A3] hover:text-[#FAFAFA]'
  }`;