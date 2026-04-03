import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = 'description' | 'faq' | 'tone_guidelines' | 'logo' | 'document';

interface TrainingEntry {
  id: string;
  type: EntryType;
  content: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

const TYPE_META: Record<EntryType, { label: string; icon: string; hint: string; allowFile: boolean; allowText: boolean }> = {
  description: {
    label: 'Business Description',
    icon: '🏢',
    hint: 'Describe your business, what you sell, your mission and values.',
    allowFile: false,
    allowText: true,
  },
  faq: {
    label: 'FAQs',
    icon: '❓',
    hint: 'Add frequently asked questions and their answers.',
    allowFile: false,
    allowText: true,
  },
  tone_guidelines: {
    label: 'Tone & Style',
    icon: '🎨',
    hint: 'Describe how the AI should communicate — formal, friendly, concise, etc.',
    allowFile: false,
    allowText: true,
  },
  logo: {
    label: 'Logo',
    icon: '🖼️',
    hint: 'Upload your business logo (PNG or JPG). Used on your WhatsApp profile.',
    allowFile: true,
    allowText: false,
  },
  document: {
    label: 'Documents',
    icon: '📄',
    hint: 'Upload PDFs or text files — product manuals, policies, price lists, etc.',
    allowFile: true,
    allowText: false,
  },
};

const TABS: EntryType[] = ['description', 'faq', 'tone_guidelines', 'logo', 'document'];

const BASE_URL = import.meta.env.VITE_API_URL || '';

// ─── Component ────────────────────────────────────────────────────────────────

export default function Training() {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [tab, setTab] = useState<EntryType>('description');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('augustus_token') ?? '';
  const meta = TYPE_META[tab];

  const load = () =>
    apiFetch<{ entries: TrainingEntry[] }>('/training')
      .then((r) => setEntries(r.entries ?? []))
      .catch(() => {});

  useEffect(() => { load(); }, []);

  // Reset form when switching tabs
  const switchTab = (t: EntryType) => {
    setTab(t);
    setText('');
    setFile(null);
    setLabel('');
    setError('');
    setMsg('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      if (meta.allowFile && file) {
        const fd = new FormData();
        fd.append('type', tab);
        if (label.trim()) fd.append('label', label.trim());
        fd.append('file', file);

        let res: Response;
        try {
          res = await fetch(`${BASE_URL}/training/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        } catch (networkErr) {
          throw new Error(`Network error — is the API running at ${BASE_URL}? (${networkErr instanceof Error ? networkErr.message : String(networkErr)})`);
        }

        if (!res.ok) {
          let errMsg = `Upload failed (HTTP ${res.status})`;
          try {
            const body = await res.json() as { error?: string };
            if (body.error) errMsg = body.error;
          } catch { /* ignore parse error */ }
          throw new Error(errMsg);
        }
        setMsg('File uploaded successfully.');
        setFile(null);
        setLabel('');
        if (fileRef.current) fileRef.current.value = '';
      } else if (meta.allowText && text.trim()) {
        await apiFetch('/training', {
          method: 'POST',
          body: JSON.stringify({ type: tab, content: text.trim() }),
        });
        setMsg('Entry saved.');
        setText('');
      } else {
        setError('Please provide content or select a file.');
        setLoading(false);
        return;
      }
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await apiFetch(`/training/${id}`, { method: 'DELETE' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  const tabEntries = entries.filter((e) => e.type === tab);

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ marginBottom: 4 }}>AI Training Data</h2>
      <p style={{ color: '#718096', fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Teach your AI agent about your business. Changes take effect within minutes.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const m = TYPE_META[t];
          const count = entries.filter((e) => e.type === t).length;
          return (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: tab === t ? '#3182ce' : '#718096',
                borderBottom: tab === t ? '2px solid #3182ce' : '2px solid transparent',
                marginBottom: -2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {m.icon} {m.label}
              {count > 0 && (
                <span style={{ background: tab === t ? '#3182ce' : '#e2e8f0', color: tab === t ? '#fff' : '#4a5568', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Input panel */}
      <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 28 }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4a5568' }}>{meta.hint}</p>

        {error && <p style={errStyle}>{error}</p>}
        {msg && <p style={okStyle}>{msg}</p>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meta.allowText && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={tab === 'faq' ? 6 : 4}
              placeholder={tab === 'faq' ? 'Q: What are your delivery times?\nA: We deliver within 2–3 business days.' : `Enter your ${meta.label.toLowerCase()} here…`}
              style={textareaStyle}
            />
          )}

          {meta.allowFile && (
            <div>
              {tab === 'document' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Label (optional)</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Price List 2025, Return Policy"
                    style={inputStyle}
                  />
                </div>
              )}
              <label style={labelStyle}>
                {tab === 'logo' ? 'Logo file (PNG, JPG)' : 'File (PDF, TXT, DOCX — max 10 MB)'}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={tab === 'logo' ? 'image/png,image/jpeg' : '.pdf,.txt,.docx,application/pdf,text/plain'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: 'block', marginTop: 4, fontSize: 13 }}
              />
              {file && (
                <p style={{ fontSize: 12, color: '#4a5568', margin: '6px 0 0' }}>
                  {file.name} — {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          )}

          <div>
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Saving…' : meta.allowFile ? 'Upload' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>

      {/* Entries list */}
      <div>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15, color: '#2d3748' }}>
          {meta.icon} {meta.label} {tabEntries.length > 0 ? `(${tabEntries.length})` : ''}
        </h3>

        {tabEntries.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#a0aec0', fontSize: 14, border: '1px dashed #e2e8f0', borderRadius: 8 }}>
            No {meta.label.toLowerCase()} entries yet
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tabEntries.map((entry) => (
            <div key={entry.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {entry.fileUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{tab === 'logo' ? '🖼️' : '📄'}</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#2d3748' }}>
                          {entry.content || 'Uploaded file'}
                        </p>
                        <a
                          href={entry.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: '#3182ce' }}
                        >
                          View file ↗
                        </a>
                        {entry.fileSizeBytes && (
                          <span style={{ fontSize: 11, color: '#a0aec0', marginLeft: 8 }}>
                            {(entry.fileSizeBytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, color: '#2d3748', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {entry.content}
                    </p>
                  )}
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#a0aec0' }}>
                    Added {new Date(entry.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => remove(entry.id)} style={deleteBtnStyle} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 3 };
const inputStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box' };
const textareaStyle: React.CSSProperties = { padding: '10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 };
const btnStyle: React.CSSProperties = { padding: '9px 22px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const deleteBtnStyle: React.CSSProperties = { padding: '4px 8px', background: 'none', color: '#a0aec0', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 13, flexShrink: 0 };
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 10px' };
const okStyle: React.CSSProperties = { color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 10px' };
