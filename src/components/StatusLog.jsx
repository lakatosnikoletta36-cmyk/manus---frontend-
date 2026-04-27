import React from 'react';

const TYPE_COLORS = {
  thinking: 'text-purple-400 border-purple-400/30',
  browsing: 'text-blue-400 border-blue-400/30',
  updating_memory: 'text-emerald-400 border-emerald-400/30',
  observing: 'text-cyan-400 border-cyan-400/30',
  user_input: 'text-white/60 border-white/20',
  system: 'text-amber-400 border-amber-400/30',
};

const TYPE_LABELS = {
  thinking: 'gondolkodás',
  browsing: 'böngészés',
  updating_memory: 'fejlődés',
  observing: 'megfigyelés',
  user_input: 'bemenet',
  system: 'rendszer',
};

export default function StatusLog({ events }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events]);

  return (
    <div className="bg-[#050505] border border-emerald-500/20 rounded-md overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">// állapot_napló</span>
        <span className="text-[10px] text-emerald-400/60">{events.length} esemény</span>
      </div>
      <div ref={ref} data-testid="status-log" className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5">
        {events.length === 0 ? (
          <div className="text-emerald-400/40 blink-cursor">jelre várok</div>
        ) : (
          events.map((ev, i) => {
            const cls = TYPE_COLORS[ev.type] || 'text-emerald-400 border-emerald-400/20';
            const label = TYPE_LABELS[ev.type] || ev.type;
            const time = ev.t ? new Date(ev.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
            return (
              <div key={i} className={`flex items-start gap-2 ${cls.split(' ')[0]}`}>
                <span className="opacity-40 shrink-0">[{time}]</span>
                <span className="opacity-60 shrink-0 uppercase tracking-wider">{label}</span>
                <span className="opacity-90">{ev.label}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
