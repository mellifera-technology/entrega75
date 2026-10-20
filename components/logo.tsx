import Link from 'next/link';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="relative h-9 w-10">
        <span className="hex absolute left-0 top-0 h-8 bg-amber-400/90" />
        <span className="hex absolute left-4 top-2 h-5 bg-emerald-300/80" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-sm font-black tracking-[0.22em] text-white">MELLIFERA</div>
          <div className="mt-1 text-[10px] font-semibold tracking-[0.34em] text-amber-300">TECHNOLOGY</div>
        </div>
      )}
    </Link>
  );
}
