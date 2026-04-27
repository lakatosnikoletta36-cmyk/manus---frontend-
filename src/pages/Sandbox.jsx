import React, { useEffect, useState, useRef } from 'react';
import TopBar from '@/components/TopBar';
import { fetchSandboxFiles, uploadSandboxFile, deleteSandboxFile } from '@/lib/api';
import { Upload, Trash2, Lock, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function Sandbox({ user }) {
  const [files, setFiles] = useState([]);
  const [path, setPath] = useState('');
  const inputRef = useRef();

  const refresh = () =>
    fetchSandboxFiles().then((d) => { setFiles(d.files); setPath(d.path); }).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const onUpload = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try {
      await uploadSandboxFile(f);
      toast.success(`A homokozóba helyezve: ${f.name}`);
      refresh();
    } catch (err) {
      toast.error('A feltöltés sikertelen');
    }
    ev.target.value = '';
  };

  const onDelete = async (name) => {
    try {
      await deleteSandboxFile(name);
      refresh();
    } catch { toast.error('Törlés sikertelen'); }
  };

  const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(1)} MB`;

  return (
    <div className="min-h-screen bg-[#030305] text-white">
      <TopBar user={user} active="sandbox" />
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 mb-2">// megosztott_mappa</div>
          <h1 className="text-4xl lg:text-5xl font-light tracking-tighter">Homokozó</h1>
          <p className="text-sm text-white/50 mt-2 max-w-2xl">
            A héj kizárólag ezt a mappát látja. Minden más fájl a rendszereden privát marad.
          </p>
        </div>

        <div className="bg-[#0A0A0F] border border-white/5 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs text-white/60 font-mono">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">elszigetelt</span>
              <span className="text-white/30">·</span>
              <span>{path || '/sandbox/'}</span>
            </div>
            <button
              data-testid="upload-button"
              onClick={() => inputRef.current?.click()}
              className="bg-cyan-400 text-black text-[11px] tracking-[0.2em] uppercase px-3 py-1.5 rounded hover:bg-white transition-colors"
            >
              <Upload className="w-3 h-3 inline mr-1" /> feltöltés
            </button>
            <input ref={inputRef} type="file" hidden onChange={onUpload} data-testid="upload-input" />
          </div>

          <div className="divide-y divide-white/5" data-testid="files-list">
            {files.length === 0 ? (
              <div className="p-12 text-center text-white/30">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <div className="text-sm">A homokozó üres.</div>
                <div className="text-xs mt-1 text-white/20">Tölts fel bármit, amit szeretnél, hogy a héj elérjen.</div>
              </div>
            ) : files.map((f) => (
              <div key={f.name} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-cyan-400/70 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{f.name}</div>
                    <div className="text-[11px] text-white/40 font-mono">{fmtSize(f.size)} · {new Date(f.modified).toLocaleString('hu-HU')}</div>
                  </div>
                </div>
                <button
                  data-testid={`delete-${f.name}`}
                  onClick={() => onDelete(f.name)}
                  className="text-white/30 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-200/80 leading-relaxed">
          <strong className="tracking-wider uppercase text-amber-300">Adatvédelmi tűzfal:</strong> A Manus csak ezt a mappát olvashatja. A homokozón kívüli személyes fájlok elérhetetlenek számára, hacsak Te magad nem helyezed át őket ide.
        </div>
      </div>
    </div>
  );
}
