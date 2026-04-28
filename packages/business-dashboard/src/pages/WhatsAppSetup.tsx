import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

declare global {
  interface Window {
    FB: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (res: FBLoginResponse) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FBLoginResponse {
  authResponse?: { code?: string };
  status: string;
}

interface EmbeddedSignupConfig {
  appId: string;
  configId: string;
  graphApiVersion: string;
}

interface Integration {
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  status: string;
  errorMessage?: string | null;
  accessTokenSet?: boolean;
}

type View = 'main' | 'manual';

export default function WhatsAppSetup() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [sdkConfig, setSdkConfig] = useState<EmbeddedSignupConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [view, setView] = useState<View>('main');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState({ wabaId: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '' });
  const [notifNumber, setNotifNumber] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [templates, setTemplates] = useState<Array<{ name: string; category: string; status: string }>>([]);
  const [templateMsg, setTemplateMsg] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templatesSubmitted, setTemplatesSubmitted] = useState(false);
  const sdkInitialised = useRef(false);

  useEffect(() => {
    if (view === 'manual' && integration) {
      setManual((f) => ({
        ...f,
        wabaId: integration.wabaId ?? f.wabaId,
        phoneNumberId: integration.phoneNumberId ?? f.phoneNumberId,
        webhookVerifyToken: '',
      }));
    }
  }, [view]);

  // Handle OAuth redirect: Meta may redirect back with ?code=... in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Remove the code from the URL immediately to prevent re-processing on refresh
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    setLoading(true);
    setError('');
    setMsg('');
    exchangeCode(code);
  }, []);

  useEffect(() => {
    Promise.allSettled([
      apiFetch<Integration>('/whatsapp/integration').then(setIntegration).catch(() => {}),
      apiFetch<EmbeddedSignupConfig>('/whatsapp/integration/embedded-signup-config')
        .then((cfg) => { setSdkConfig(cfg); initSdk(cfg); })
        .catch(() => {}),
      apiFetch<{ notificationWaNumber: string | null }>('/dashboard/notification-number')
        .then((r) => setNotifNumber(r.notificationWaNumber ?? ''))
        .catch(() => {}),
      apiFetch<{ templates: Array<{ name: string; category: string; status: string }> }>('/whatsapp/templates')
        .then((r) => {
          const tmpl = r.templates ?? [];
          setTemplates(tmpl);
          // Mark as submitted if any templates exist with a meta ID (already submitted before)
          if (tmpl.some(t => t.status !== 'PENDING' || tmpl.length > 0)) {
            setTemplatesSubmitted(tmpl.length > 0 && tmpl.every(t => t.status !== 'PENDING' || t.status === 'PENDING'));
          }
        })
        .catch(() => {}),
    ]).finally(() => setPageLoading(false));
  }, []);

  // Seed and auto-submit templates after successful WhatsApp connection
  const seedAndSubmitTemplates = async () => {
    try {
      setTemplateMsg('Setting up message templates…');
      // Seed platform templates
      await apiFetch('/whatsapp/templates/seed', { method: 'POST' });
      // Submit all pending templates to Meta
      const result = await apiFetch<{ submitted: number; failed: number }>('/whatsapp/templates/submit-all', { method: 'POST' });
      setTemplateMsg(`✅ ${result.submitted} message templates submitted to Meta for approval.`);
      setTemplatesSubmitted(true);
      // Refresh template list
      apiFetch<{ templates: Array<{ name: string; category: string; status: string }> }>('/whatsapp/templates')
        .then((r) => setTemplates(r.templates ?? []))
        .catch(() => {});
    } catch {
      setTemplateMsg('Templates seeded locally. Submit them for Meta approval below.');
    }
  };

  const handleSeedAndSubmit = async () => {
    setTemplateLoading(true);
    setTemplateMsg('');
    await seedAndSubmitTemplates();
    setTemplatesSubmitted(true);
    setTemplateLoading(false);
  };

  const handleSyncTemplates = async () => {
    setTemplateLoading(true);
    setTemplateMsg('');
    try {
      const result = await apiFetch<{ synced: number; approved: number; rejected: number; error?: string }>('/whatsapp/templates/sync', { method: 'POST' });
      if (result.error) {
        setTemplateMsg(`⚠️ Sync error: ${result.error}`);
      } else {
        setTemplateMsg(`Synced ${result.synced} templates. ${result.approved} approved, ${result.rejected} rejected.`);
      }
      apiFetch<{ templates: Array<{ name: string; category: string; status: string }> }>('/whatsapp/templates')
        .then((r) => setTemplates(r.templates ?? []))
        .catch(() => {});
    } catch (err) {
      setTemplateMsg(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setTemplateLoading(false);
    }
  };

  function initSdk(cfg: EmbeddedSignupConfig) {
    if (sdkInitialised.current) return;
    const doInit = () => {
      if (!window.FB) return;
      window.FB.init({ appId: cfg.appId, autoLogAppEvents: true, xfbml: false, version: cfg.graphApiVersion });
      sdkInitialised.current = true;
      setSdkReady(true);
    };
    if (window.FB) { doInit(); } else {
      window.fbAsyncInit = doInit;
      const interval = setInterval(() => { if (window.FB) { clearInterval(interval); doInit(); } }, 200);
      setTimeout(() => clearInterval(interval), 10_000);
    }
  }

  // Listen for Meta's postMessage when embedded signup completes in a popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Meta domains
      if (!event.origin.includes('facebook.com') && !event.origin.includes('meta.com')) return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // Meta sends this when embedded signup is complete
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH' || data.event === 'SUBMIT') {
            const code = data.data?.code;
            if (code) {
              setLoading(true);
              setError('');
              setMsg('Completing WhatsApp connection…');
              exchangeCode(code);
            }
          } else if (data.event === 'CANCEL') {
            setError('WhatsApp setup was cancelled. Please try again.');
          } else if (data.event === 'ERROR') {
            setError(`WhatsApp setup error: ${data.data?.error_message ?? 'Unknown error'}`);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const exchangeCode = (code: string) => {
    apiFetch<Integration & {
      webhookStatus: string;
      registrationStatus: string;
      registrationError: string | null;
      webhookError: string | null;
      codeVerificationStatus: string;
      nameStatus: string;
    }>('/whatsapp/integration/exchange-token', {
      method: 'POST', body: JSON.stringify({ code }),
    }).then((result) => {
      setIntegration({ ...result, status: result.webhookStatus === 'active' ? 'active' : result.status });
      setView('main');

      const regOk = result.registrationStatus === 'registered' || result.registrationStatus === 'already_registered';
      const webhookOk = result.webhookStatus === 'active';

      if (regOk && webhookOk) {
        setMsg(`✅ WhatsApp connected! ${result.displayPhoneNumber ?? ''} ${result.verifiedName ? `(${result.verifiedName})` : ''} — your AI agent is ready.`);
        // Auto-seed and submit templates after successful connection
        void seedAndSubmitTemplates();
      } else if (regOk && !webhookOk) {
        setMsg(`⚠️ Connected but webhook pending. Click "Register Webhook" to activate.`);
      } else if (!regOk) {
        setError(result.registrationError ?? 'Phone number registration failed. If this number is active on WhatsApp, remove it from the WhatsApp app first, wait 3 minutes, then reconnect.');
      }
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    }).finally(() => {
      setLoading(false);
      setMsg(prev => prev === 'Completing WhatsApp connection…' ? '' : prev);
    });
  };

  const handleEmbeddedSignup = () => {
    if (!window.FB) { setError('Facebook SDK not loaded. Please refresh and try again.'); return; }
    if (!sdkConfig) { setError('WhatsApp config not loaded. Please refresh and try again.'); return; }
    setError(''); setMsg('');

    // Open Meta's embedded signup — it uses a popup internally
    // The postMessage listener above will handle the completion event
    window.FB.login((response) => {
      const code = response.authResponse?.code;
      if (code) {
        setLoading(true);
        setMsg('Completing WhatsApp connection…');
        exchangeCode(code);
      } else if (response.status === 'connected') {
        // Already connected — refresh integration status
        apiFetch<Integration>('/whatsapp/integration').then(setIntegration).catch(() => {});
      } else if (response.status !== 'unknown') {
        setError('Connection was cancelled or failed. Please try again.');
      }
    }, {
      config_id: sdkConfig.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: 'whatsapp_business_app_onboarding',
        sessionInfoVersion: '3',
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg(''); setLoading(true);
    try {
      const result = await apiFetch<Integration>('/whatsapp/integration', { method: 'POST', body: JSON.stringify(manual) });
      setIntegration(result);
      setMsg('Credentials saved. Use "Register Webhook" to activate.');
      setView('main');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials.');
    } finally { setLoading(false); }
  };

  const handleRegisterWebhook = async () => {
    setError(''); setMsg(''); setLoading(true);
    try {
      await apiFetch('/whatsapp/integration/register-webhook', { method: 'POST' });
      setIntegration((prev) => prev ? { ...prev, status: 'active' } : prev);
      setMsg('Webhook registered — integration is now active.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Webhook registration failed.');
    } finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect WhatsApp? This will stop the AI agent from receiving messages.')) return;
    setLoading(true);
    try {
      await apiFetch('/whatsapp/integration/webhook', { method: 'DELETE' });
      await apiFetch('/whatsapp/integration', { method: 'DELETE' });
      setIntegration(null); setMsg('WhatsApp disconnected.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Disconnect failed.');
    } finally { setLoading(false); }
  };

  const saveNotifNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSaving(true); setNotifMsg('');
    try {
      await apiFetch('/dashboard/notification-number', {
        method: 'PUT',
        body: JSON.stringify({ notificationWaNumber: notifNumber }),
      });
      setNotifMsg('Saved.');
      setTimeout(() => setNotifMsg(''), 3000);
    } catch (err: unknown) {
      setNotifMsg(err instanceof Error ? err.message : 'Failed to save.');
    } finally { setNotifSaving(false); }
  };

  const isActive = integration?.status === 'active';
  const embeddedSignupAvailable = sdkReady && !!sdkConfig?.configId;

  if (pageLoading) {
    return (
      <div style={pageStyle}>
        <h2 style={{ marginBottom: 4 }}>WhatsApp Integration</h2>
        <div style={{ padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f7fafc', color: '#718096', fontSize: 14 }}>
          Loading integration status…
        </div>
      </div>
    );
  }

  if (view === 'manual') {
    return (
      <div style={pageStyle}>
        <h2 style={{ marginBottom: 4 }}>Manual WhatsApp Setup</h2>
        <p style={{ color: '#718096', marginBottom: 20, fontSize: 14 }}>Enter your credentials from the Meta Developer Console.</p>
        {error && <p style={errorStyle}>{error}</p>}
        <form onSubmit={handleManualSubmit} style={formStyle}>
          <label style={labelStyle}>WABA ID</label>
          <p style={hintStyle}>Your WhatsApp Business Account ID — numeric ID from Meta Business Manager</p>
          <input style={inputStyle} value={manual.wabaId} onChange={(e) => setManual((f) => ({ ...f, wabaId: e.target.value }))} required placeholder="123456789012345" pattern="[0-9]+" />

          <label style={labelStyle}>Phone Number ID</label>
          <p style={hintStyle}>Numeric Phone Number ID from Meta — not your actual phone number</p>
          <input style={inputStyle} value={manual.phoneNumberId} onChange={(e) => setManual((f) => ({ ...f, phoneNumberId: e.target.value }))} required placeholder="987654321098765" pattern="[0-9]+" />

          <label style={labelStyle}>Access Token (System User Token)</label>
          <p style={hintStyle}>Permanent System User token from Meta Business Manager — starts with "EAA..."</p>
          <input style={inputStyle} type="password" value={manual.accessToken} onChange={(e) => setManual((f) => ({ ...f, accessToken: e.target.value }))} required placeholder="EAAxxxxxxxxxxxxxxx" />

          <label style={labelStyle}>Webhook Verify Token</label>
          <p style={hintStyle}>A secret string you choose — used to verify webhook callbacks from Meta</p>
          <input style={inputStyle} value={manual.webhookVerifyToken} onChange={(e) => setManual((f) => ({ ...f, webhookVerifyToken: e.target.value }))} required placeholder="any-secret-string-you-choose" />

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={loading} style={primaryBtn}>{loading ? 'Saving…' : 'Save Credentials'}</button>
            <button type="button" onClick={() => setView('main')} style={ghostBtn}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Loading overlay while connecting */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: 0 }}>
            {msg === 'Completing WhatsApp connection…' ? 'Connecting WhatsApp…' : 'Processing…'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>Please wait, do not close this page</p>
        </div>
      )}

      <h2 style={{ marginBottom: 4 }}>WhatsApp Integration</h2>
      <p style={{ color: '#718096', marginBottom: 24, fontSize: 14 }}>
        Connect your WhatsApp Business number so the AI agent can send and receive messages.
      </p>

      {error && <p style={errorStyle}>{error}</p>}
      {msg && <p style={successStyle}>{msg}</p>}

      {integration ? (
        <div style={statusCard(isActive)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {integration.displayPhoneNumber ?? integration.phoneNumberId ?? 'WhatsApp Connected'}
            </span>
            <span style={{ ...statusBadge, background: isActive ? '#c6f6d5' : '#fed7d7', color: isActive ? '#276749' : '#9b2c2c' }}>
              {integration.status}
            </span>
          </div>
          {integration.verifiedName && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4a5568' }}>{integration.verifiedName}</p>}
          {integration.errorMessage && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c53030' }}>{integration.errorMessage}</p>}
          {integration.wabaId && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>WABA: {integration.wabaId}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {!isActive && (
              <button onClick={handleRegisterWebhook} disabled={loading} style={primaryBtn}>
                {loading ? 'Registering…' : 'Register Webhook'}
              </button>
            )}
            <button onClick={() => setView('manual')} disabled={loading} style={ghostBtn}>Edit Credentials</button>
            <button onClick={handleDisconnect} disabled={loading} style={dangerBtn}>Disconnect</button>
          </div>
        </div>
      ) : (
        <div style={connectCard}>
          {embeddedSignupAvailable ? (
            <>
              <p style={{ marginBottom: 16, fontSize: 14, color: '#4a5568' }}>
                Connect your WhatsApp Business account in a few clicks using Meta's guided setup.
              </p>
              <button onClick={handleEmbeddedSignup} disabled={loading} style={{ ...primaryBtn, fontSize: 15, padding: '12px 24px' }}>
                {loading ? 'Connecting…' : '🔗  Connect WhatsApp Business'}
              </button>
              <p style={{ marginTop: 16, fontSize: 13, color: '#a0aec0' }}>
                Already have credentials?{' '}
                <button onClick={() => setView('manual')} style={linkBtn}>Enter them manually</button>
              </p>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 16, fontSize: 14, color: '#4a5568' }}>
                Enter your WhatsApp Business credentials from the Meta Developer Console.
              </p>
              <button onClick={() => setView('manual')} style={primaryBtn}>Set Up Manually</button>
            </>
          )}
        </div>
      )}

      {integration && embeddedSignupAvailable && (
        <p style={{ marginTop: 16, fontSize: 13, color: '#a0aec0' }}>
          Need to connect a different number?{' '}
          <button onClick={handleEmbeddedSignup} disabled={loading} style={linkBtn}>Re-run WhatsApp setup</button>
          {' or '}
          <button onClick={() => setView('manual')} style={linkBtn}>update manually</button>
        </p>
      )}

      {/* Message Templates Section */}
      {integration && (
        <div style={{ marginTop: 28, padding: '20px 24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <h3 style={{ margin: 0, fontSize: 15, color: '#1a202c' }}>Message Templates</h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSyncTemplates} disabled={templateLoading} style={{ ...ghostBtn, fontSize: 12, padding: '6px 12px' }}>
                {templateLoading ? '…' : '↻ Sync from Meta'}
              </button>
              <button onClick={handleSeedAndSubmit} disabled={templateLoading || templatesSubmitted} style={{ ...primaryBtn, fontSize: 12, padding: '6px 14px', background: templatesSubmitted ? '#38a169' : '#3182ce' }}>
                {templateLoading ? 'Submitting…' : templatesSubmitted ? '✅ Submitted' : '📤 Submit Templates to Meta'}
              </button>
            </div>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#718096', lineHeight: 1.5 }}>
            WhatsApp requires pre-approved templates for broadcasts and business-initiated messages. Templates are automatically submitted when you connect your number.
          </p>
          {templateMsg && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: templateMsg.startsWith('⚠️') ? '#c53030' : '#276749', background: templateMsg.startsWith('⚠️') ? '#fff5f5' : '#f0fff4', padding: '8px 12px', borderRadius: 6, border: `1px solid ${templateMsg.startsWith('⚠️') ? '#feb2b2' : '#9ae6b4'}` }}>
              {templateMsg}
            </p>
          )}
          {templates.length === 0 ? (
            <p style={{ fontSize: 13, color: '#a0aec0', margin: 0 }}>No templates yet. Click "Submit Templates to Meta" to get started.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map(t => {
                const statusColor = t.status === 'APPROVED' ? '#276749' : t.status === 'REJECTED' ? '#c53030' : '#92400e';
                const statusBg = t.status === 'APPROVED' ? '#f0fff4' : t.status === 'REJECTED' ? '#fff5f5' : '#fffbeb';
                return (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f7fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#2d3748', fontFamily: 'monospace' }}>{t.name}</span>
                      <span style={{ fontSize: 11, color: '#718096', marginLeft: 8 }}>[{t.category}]</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: statusBg, color: statusColor }}>{t.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notification number section */}
      <div style={{ marginTop: 32, padding: '20px 24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <h3 style={{ margin: 0, fontSize: 15, color: '#1a202c' }}>Order & Lead Notifications</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
          Enter your personal WhatsApp number to receive instant alerts when a customer places an order or shows strong buying intent. Only important events — no spam.
        </p>
        <form onSubmit={saveNotifNumber} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Your WhatsApp Number</label>
            <p style={hintStyle}>Include country code, e.g. 263771234567 (no + or spaces)</p>
            <input
              type="tel"
              value={notifNumber}
              onChange={(e) => setNotifNumber(e.target.value.replace(/[^\d+]/g, ''))}
              placeholder="263771234567"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 2 }}>
            <button type="submit" disabled={notifSaving} style={primaryBtn}>
              {notifSaving ? 'Saving…' : 'Save'}
            </button>
            {notifMsg && (
              <span style={{ fontSize: 13, color: notifMsg === 'Saved.' ? '#276749' : '#c53030' }}>
                {notifMsg}
              </span>
            )}
          </div>
        </form>
        {notifNumber && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#a0aec0' }}>
            Notifications will be sent to <strong style={{ color: '#4a5568' }}>+{notifNumber}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// --- Styles ------------------------------------------------------------------

const pageStyle: React.CSSProperties = { maxWidth: 560, padding: '24px 0' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 440 };
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: -4 };
const inputStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', outline: 'none' };
const errorStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 12 };
const successStyle: React.CSSProperties = { color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 12 };
const hintStyle: React.CSSProperties = { fontSize: 12, color: '#718096', margin: '-4px 0 2px' };
const primaryBtn: React.CSSProperties = { padding: '10px 20px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const ghostBtn: React.CSSProperties = { padding: '10px 20px', background: 'transparent', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const dangerBtn: React.CSSProperties = { padding: '8px 16px', background: 'transparent', color: '#c53030', border: '1px solid #feb2b2', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' };
const statusBadge: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12 };
const statusCard = (active: boolean): React.CSSProperties => ({
  padding: 16, borderRadius: 8,
  border: `1px solid ${active ? '#9ae6b4' : '#fed7d7'}`,
  background: active ? '#f0fff4' : '#fff5f5',
  marginBottom: 16,
});
const connectCard: React.CSSProperties = { padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f7fafc' };
