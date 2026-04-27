import React, { useEffect, useRef, useState, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import AvatarBoundary from '@/components/AvatarBoundary';
import StatusLog from '@/components/StatusLog';
import { processManus, fetchMessages, sendSnapshot } from '@/lib/api';
import { Send, Mic, MicOff, Camera, CameraOff } from 'lucide-react';
import { toast } from 'sonner';

function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return null;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'hu-HU';
    u.rate = 1.0;
    u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const huVoice = voices.find(v => /hu[-_]?HU/i.test(v.lang));
    const fallback = voices.find(v => /female|samantha|aria|zira/i.test(v.name)) || voices[0];
    if (huVoice) u.voice = huVoice; else if (fallback) u.voice = fallback;
    window.speechSynthesis.speak(u);
    return u;
  } catch (e) { return null; }
}

export default function Shell({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mood, setMood] = useState({ joy: 0.5, stress: 0.2, curiosity: 0.6, calm: 0.6, anger: 0, sadness: 0, embarrassment: 0 });
  const [posture, setPosture] = useState('idle');
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusEvents, setStatusEvents] = useState([]);
  const [listening, setListening] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recogRef = useRef(null);
  const msgEndRef = useRef(null);

  const pushStatus = (type, label) =>
    setStatusEvents((prev) => [...prev.slice(-200), { type, label, t: Date.now() }]);

  useEffect(() => {
    fetchMessages()
      .then((rows) => {
        setMessages(rows);
        const lastAi = [...rows].reverse().find((m) => m.role === 'ai');
        if (lastAi?.mood) setMood(lastAi.mood);
        pushStatus('system', `${rows.length} korábbi üzenet betöltve`);
      })
      .catch(() => pushStatus('system', 'nincs előzmény'));
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text, fromVoice = false) => {
    const content = (text ?? input).trim();
    if (!content && !cameraOn) return;
    setBusy(true);
    setInput('');
    setPosture('thinking');
    pushStatus('user_input', fromVoice ? `hang: "${content}"` : content.slice(0, 80));
    pushStatus('thinking', 'Manus elme feldolgoz');

    setMessages((m) => [...m, {
      id: 'tmp_' + Date.now(),
      role: 'user', content,
      created_at: new Date().toISOString(),
    }]);

    let image_b64 = null;
    if (cameraOn && videoRef.current) {
      try {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 240;
        c.getContext('2d').drawImage(videoRef.current, 0, 0, 320, 240);
        image_b64 = c.toDataURL('image/jpeg', 0.6).split(',')[1];
        pushStatus('observing', 'kamerakép rögzítve');
      } catch (e) { /* ignore */ }
    }

    try {
      const res = await processManus({ text: content, voice_text: fromVoice ? content : null, image_b64 });
      const instr = res.instruction;
      // merge incoming mood with current so missing keys retain previous value
      setMood((prev) => ({ ...prev, ...(instr.mood || {}) }));
      setPosture(instr.posture || 'idle');
      (instr.status_events || []).forEach((ev) => pushStatus(ev.type, ev.label));
      if (instr.knowledge_topics?.length) {
        pushStatus('updating_memory', `témák: ${instr.knowledge_topics.join(', ')}`);
      }
      // Live personality evolution feedback
      const drift = instr.personality_drift || {};
      Object.entries(drift).forEach(([trait, delta]) => {
        const d = Number(delta);
        if (!d) return;
        const arrow = d > 0 ? '↑' : '↓';
        const pct = (Math.abs(d) * 100).toFixed(1);
        pushStatus('updating_memory', `${arrow} ${trait} ${d > 0 ? '+' : '−'}${pct}`);
      });
      setMessages((m) => [...m, {
        id: res.message_id,
        role: 'ai',
        content: instr.speech,
        mood: instr.mood,
        created_at: new Date().toISOString(),
      }]);

      setSpeaking(true);
      const utter = speak(instr.speech);
      if (utter) {
        utter.onend = () => { setSpeaking(false); setPosture('idle'); };
      } else {
        setTimeout(() => { setSpeaking(false); setPosture('idle'); }, 1500);
      }

      if (image_b64) {
        sendSnapshot(image_b64).catch(() => {});
      }
    } catch (e) {
      pushStatus('system', 'a Manus elme nem elérhető');
      toast.error('Manus kapcsolat hiba.');
      setPosture('idle');
    } finally {
      setBusy(false);
    }
  }, [input, cameraOn]);

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Hangbevitel nem támogatott ebben a böngészőben.');
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'hu-HU';
    r.onstart = () => { setListening(true); pushStatus('observing', 'hallgatok'); };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); pushStatus('system', 'hangfelismerési hiba'); };
    r.onresult = (ev) => {
      const t = ev.results[0][0].transcript;
      send(t, true);
    };
    recogRef.current = r;
    r.start();
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      pushStatus('system', 'kamera kikapcsolva');
      return;
    }
    try {
      const s = await Promise.reject({ video: { width: 320, height: 240 } });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setCameraOn(true);
      pushStatus('observing', 'kamera bekapcsolva — Manus lát');
    } catch (e) {
      toast.error('A kamerához nincs hozzáférés');
    }
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    window.speechSynthesis?.cancel();
  }, []);

  const moodLabels = { joy: 'öröm', stress: 'stressz', curiosity: 'kíváncsiság', calm: 'nyugalom', anger: 'düh', sadness: 'szomorúság', embarrassment: 'zavarodottság' };
  const postureLabels = { idle: 'nyugalmi', leaning: 'figyelmes', thinking: 'gondolkodó', attentive: 'éber', slumped: 'lehorgasztott', excited: 'lelkes', defensive: 'védekező' };

  return (
    <div className="min-min-h-screen overflow-y-auto bg-[#030305] text-white">
      <TopBar user={user} active="shell" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6 h-[calc(100vh-60px)]">
        <div className="lg:col-span-7 relative bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden grain" style={{ minHeight: 460 }}>
          <div className="absolute top-4 left-4 z-10 text-[10px] tracking-[0.3em] uppercase text-cyan-400/80">// test</div>
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <span className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded bg-black/40 border border-white/10 text-white/60">
              testtartás: <span className="text-cyan-400">{postureLabels[posture] || posture}</span>
            </span>
          </div>

          <div className="absolute bottom-4 left-4 z-10 space-y-1.5 w-44 max-h-[55%] overflow-y-auto pr-1">
            {Object.entries(mood).map(([k, v]) => {
              const isAnger = k === 'anger';
              const isSad = k === 'sadness';
              const isJoy = k === 'joy';
              const isBlush = k === 'embarrassment';
              const barColor = isAnger ? '#EF4444' : isSad ? '#3B82F6' : isJoy ? '#FACC15' : isBlush ? '#FF6FA8' : '#00F0FF';
              return (
                <div key={k} className="text-[10px] uppercase tracking-wider text-white/60">
                  <div className="flex justify-between mb-0.5">
                    <span>{moodLabels[k] || k}</span><span style={{ color: barColor }}>{(v * 100).toFixed(0)}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded overflow-hidden">
                    <div className="h-full transition-all duration-700" style={{ width: `${v * 100}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {cameraOn && (
            <div className="absolute bottom-4 right-4 z-10 w-40 h-28 rounded-md overflow-hidden border border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.3)]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute top-1 left-1 text-[9px] text-cyan-400 tracking-widest">ÉLŐ</div>
            </div>
          )}

          <div className="w-full h-full" data-testid="avatar-canvas" style={{ minHeight: 460 }}>
            <AvatarBoundary mood={mood} posture={posture} speaking={speaking} />
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
          <div className="flex-1 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl flex flex-col overflow-hidden min-h-0">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] uppercase text-cyan-400">// párbeszéd</span>
              <span className="text-[10px] text-white/40">{messages.length} üzenet</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-thread">
              {messages.length === 0 && (
                <div className="text-center text-white/30 text-sm pt-12">
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2">készen áll</div>
                  <div>Köszöntsd a héjadat, hogy megkezdődjön a fejlődése.</div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'bg-white/10 border border-white/10 text-white rounded-2xl rounded-tr-sm p-3 max-w-[85%] backdrop-blur-md text-sm'
                        : 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-100 rounded-2xl rounded-tl-sm p-3 max-w-[85%] backdrop-blur-md text-sm'
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>

            <div className="p-3 border-t border-white/5 space-y-2">
              <div className="flex gap-2">
                <input
                  data-testid="chat-input"
                  value={input}
                  onChange={(ev) => setInput(ev.target.value)}
                  onKeyDown={(ev) => ev.key === 'Enter' && !busy && send()}
                  placeholder={busy ? 'gondolkodom...' : 'beszélj a Manus-szal...'}
                  disabled={busy}
                  className="flex-1 bg-black/50 border border-white/10 text-white rounded-md px-3 py-2.5 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 placeholder-white/30"
                />
                <button
                  data-testid="send-button"
                  onClick={() => send()}
                  disabled={busy}
                  className="bg-cyan-400 text-black rounded-md px-3 hover:bg-white transition-colors disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="voice-button"
                  onClick={toggleVoice}
                  className={`flex-1 text-[11px] tracking-[0.2em] uppercase px-3 py-2 rounded border transition-colors ${
                    listening
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-transparent border-white/10 text-white/60 hover:border-cyan-400 hover:text-cyan-400'
                  }`}
                >
                  {listening ? <MicOff className="w-3 h-3 inline mr-1" /> : <Mic className="w-3 h-3 inline mr-1" />}
                  {listening ? 'hallgatom' : 'hang'}
                </button>
                <button
                  data-testid="camera-button"
                  onClick={toggleCamera}
                  className={`flex-1 text-[11px] tracking-[0.2em] uppercase px-3 py-2 rounded border transition-colors ${
                    cameraOn
                      ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-400'
                      : 'bg-transparent border-white/10 text-white/60 hover:border-cyan-400 hover:text-cyan-400'
                  }`}
                >
                  {cameraOn ? <Camera className="w-3 h-3 inline mr-1" /> : <CameraOff className="w-3 h-3 inline mr-1" />}
                  {cameraOn ? 'lát' : 'látás'}
                </button>
              </div>
            </div>
          </div>

          <div className="h-44 shrink-0">
            <StatusLog events={statusEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}
