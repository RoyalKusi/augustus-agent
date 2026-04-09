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

interface WebhookUrlInfo {
  webhookUrl: string;
  verifyToken: string;
}

export default function WhatsAppSetup() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [sdkConfig, setSdkConfig] = useState<EmbeddedSignupConfig | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<WebhookUrlInfo | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [view, setView] = useState<View>('main');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState({ wabaId: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '' });
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
      apiFetch<WebhookUrlInfo>('/whatsapp/integration/webhook-url').then(setWebhookInfo).catch(() => {}),
    ]).finally(() => setPageLoading(false));
  }, []);

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
        setMsg(`✅ Connected: ${result.displayPhoneNumber} (${result.verifiedName}) — ready to send and receive messages.`);
      } else if (regOk && !webhookOk) {
        setMsg(`Connected: ${result.displayPhoneNumber} — registered for Cloud API. Webhook pending: ${result.webhookError ?? 'retry using Register Webhook button.'}`);
      } else if (!regOk) {
        setError(`Phone number registration issue: ${result.registrationError ?? 'unknown error'}. Verification status: ${result.codeVerificationStatus}, Name status: ${result.nameStatus}.`);
      }
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Connection failed.');
    }).finally(() => setLoading(false));
  };

  const handleEmbeddedSignup = () => {
    if (!window.FB) { setError('Facebook SDK not loaded. Please refresh and try again.'); return; }
    if (!sdkConfig) { setError('WhatsApp config not loaded. Please refresh and try again.'); return; }
    setError(''); setMsg('');
    const returnUrl = `${window.location.origin}${window.location.pathname}`;
    window.FB.login((response) => {
      const code = response.authResponse?.code;
      if (!code) { if (response.status !== 'unknown') setError('Connection was cancelled or failed.'); return; }
      setLoading(true);
      exchangeCode(code);
    }, {
      config_id: sdkConfig.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3', return_url: returnUrl },
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
