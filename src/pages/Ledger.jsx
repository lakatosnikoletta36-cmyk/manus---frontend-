import React, { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { fetchEvolutionState, fetchEvolutionHistory, fetchEvolutionInsights } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Brain, Sparkles, Activity } from 'lucide-react';

// optional Hungarian display names for common moods (free-form personality keys are shown raw)
const MOOD_HU = {
  joy: 'öröm', stress: 'stressz', curiosity: 'kíváncsiság', calm: 'nyugalom',
  anger: 'düh', sadness: 'szomorúság', embarrassment: 'zavarodottság',
};

// rotating palette so different traits get different colors
const TRAIT_COLORS = ['#00F0FF', '#A855F7', '#FACC15', '#10B981', '#F472B6', '#EF4444', '#3B82F6', '#F97316', '#8B5CF6', '#22D3EE'];

export default function Ledger({ user }) {
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    Promise.all([fetchEvolutionState(), fetchEvolutionHistory(), fetchEvolutionInsights()])
      .then(([s, h, i]) => { setState(s); setHistory(h); setInsights(i); })
      .catch(() => {});
  }, []);

  const personality = state?.personality || {};
  const traitKeys = Object.keys(personality);
  const radarData = traitKeys.map((k) => ({ trait: k, value: +(personality[k] * 100).toFixed(1) }));

  // For the line chart: union of all trait keys from history
  const historyTraitSet = new Set();
  history.forEach((h) => Object.keys(h.personality || {}).forEach((k) => historyTraitSet.add(k)));
  // limit to top 8 by current value to keep chart readable
  const chartTraits = traitKeys.length
    ? traitKeys.slice().sort((a, b) => (personality[b] || 0) - (personality[a] || 0)).slice(0, 8)
    : Array.from(historyTraitSet).slice(0, 8);

  const lineData = history.map((h, idx) => {
    const row = { n: idx + 1 };
    chartTraits.forEach((k) => {
      row[k] = +((h.personality?.[k] ?? 0) * 100).toFixed(1);
    });
    return row;
  });

  return (
    <div className="min-h-screen bg-[#030305] text-white">
      <TopBar user={user} active="ledger" />
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 mb-2">// fejlődési_főkönyv</div>
            <h1 className="text-4xl lg:text-5xl font-light tracking-tighter">A Főkönyv</h1>
            <p className="text-sm text-white/50 mt-2">Olvasható krónika arról, hogyan alakítja önmagát ez a héj.</p>
          </div>
          <div className="hidden md:flex gap-3">
            <Stat label="beszélgetések" value={state?.interactions_count ?? 0} icon={<Activity className="w-4 h-4" />} />
            <Stat label="vonások" value={traitKeys.length} icon={<Brain className="w-4 h-4" />} />
            <Stat label="témák" value={insights?.topics_count ?? 0} icon={<Sparkles className="w-4 h-4" />} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Panel className="md:col-span-5" data-testid="personality-radar"
                 title="Személyiség" subtitle="szabadon fejlődő jelzők">
            <div className="h-72">
              {traitKeys.length < 3 ? (
                <div className="h-full flex items-center justify-center text-white/30 text-sm text-center px-6">
                  Még alakul a személyiség.<br />
                  Beszélgess vele többet — minden interakció új vonást vagy árnyalatot hozhat.
                </div>
              ) : (
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="trait" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <PolarRadiusAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#475569', fontSize: 9 }} domain={[0, 100]} />
                    <Radar dataKey="value" stroke="#00F0FF" fill="#00F0FF" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
            {traitKeys.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-1.5">
                {traitKeys.sort((a, b) => personality[b] - personality[a]).map((k, i) => (
                  <span key={k} className="text-[10px] px-2 py-0.5 rounded-full border" style={{
                    borderColor: TRAIT_COLORS[i % TRAIT_COLORS.length] + '60',
                    color: TRAIT_COLORS[i % TRAIT_COLORS.length],
                    background: TRAIT_COLORS[i % TRAIT_COLORS.length] + '10',
                  }}>
                    {k} · {Math.round(personality[k] * 100)}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="md:col-span-7" title="Növekedési Történet" subtitle="vonások eltolódása az időben">
            <div className="h-72">
              {lineData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/30 text-sm">
                  Még nincs előzmény — beszélj még a héjjal.
                </div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={lineData}>
                    <XAxis dataKey="n" stroke="#475569" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} stroke="#475569" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#050505', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {chartTraits.map((k, i) => (
                      <Line key={k} type="monotone" dataKey={k} stroke={TRAIT_COLORS[i % TRAIT_COLORS.length]} strokeWidth={1.5} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel className="md:col-span-5" title="Kapcsolati Felismerések" subtitle="trendek a köztünk lévő kapcsolatban">
            <div className="space-y-2.5">
              {(insights?.insights || []).map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
            {insights?.avg_mood && Object.keys(insights.avg_mood).length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-3">átlag hangulat</div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(insights.avg_mood).map(([k, v]) => {
                    const c = k === 'anger' ? '#EF4444' : k === 'sadness' ? '#3B82F6' : k === 'joy' ? '#FACC15' : k === 'embarrassment' ? '#FF6FA8' : '#00F0FF';
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-[11px] text-white/60 mb-1">
                          <span className="uppercase tracking-wider">{MOOD_HU[k] || k}</span>
                          <span style={{ color: c }}>{(v * 100).toFixed(0)}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded overflow-hidden">
                          <div className="h-full" style={{ width: `${v * 100}%`, background: c }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          <Panel className="md:col-span-7" title="Tudástérkép" subtitle="megismert témák">
            {state?.topics_mastered?.length ? (
              <div className="flex flex-wrap gap-2" data-testid="knowledge-tags">
                {state.topics_mastered.map((t, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 tracking-wider"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-white/30 text-sm">Még nincsenek témák.</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, className = '', children, ...rest }) {
  return (
    <div className={`bg-[#0A0A0F] border border-white/5 hover:border-white/15 transition-colors duration-300 rounded-lg p-6 ${className}`} {...rest}>
      <div className="mb-4">
        <div className="text-[10px] tracking-[0.3em] uppercase text-cyan-400 mb-1">// {subtitle}</div>
        <h3 className="text-xl font-medium tracking-tight text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-white/40">
        {icon}{label}
      </div>
      <div className="text-2xl font-light text-white mt-1">{value}</div>
    </div>
  );
}
