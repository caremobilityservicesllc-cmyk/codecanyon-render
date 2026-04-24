import { showDemoWatermark } from '@/utils/demoMode';

export function DemoWatermark() {
  if (!showDemoWatermark()) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <span className="text-[120px] font-black text-muted-foreground/[0.04] rotate-[-30deg] select-none whitespace-nowrap tracking-widest">
        DEMO
      </span>
    </div>
  );
}
