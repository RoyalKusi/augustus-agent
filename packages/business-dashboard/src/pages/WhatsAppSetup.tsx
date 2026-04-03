import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

// Extend window with the Meta FB SDK global
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
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Manual form state
  const [manual, setManual] = useState({ wabaId: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '' });

  const sdkInitialised = useRef(false);

  // Pre-populate manual form when editing existing credentials
  useEffect(() => {
    if (view === 'manual' && integration) {
      setManual((f) => ({
        ...f,
        wabaId: integration.wabaId ?? f.wabaId,
        phoneNumberId: integration.phoneNumberId ?? f.phoneNumberId,
        // Don't pre-fill access token — user must re-enter for security
        webhookVerifyToken: '',
      }));
    }
  }, [view]);

  // Load current integration + SDK config on mount
  useEffect(() => {
    apiFetch<Integration>('/whatsapp/integration')
      .then(setIntegration)
      .catch(() => {});

    apiFetch<EmbeddedSignupConfig>('/whatsapp/integration/embedded-signup-config')
      .then((cfg) => {
        setSdkConfig(cfg);
        initSdk(cfg);
      })
      .catch(() => {});
  }, []);

  function initSdk(cfg: EmbeddedSignupConfig) {
    if (sdkInitialised.current) return;

    const doInit = () => {
      if (!window.FB) return;
      window.FB.init({
        appId: cfg.appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: cfg.graphApiVersion,
      });
      sdkInitialised.current = true;
      setSdkReady(true);
    };

    // SDK may already be loaded (async script) or still loading
    if (window.FB) {
      doInit();
    } else {
      window.fbAsyncInit = doInit;
      // Fallback poll in case the script loaded before fbAsyncInit was set
      const interval = setInterval(() => {
        if (window.FB) {
          clearInterval(interval);
          doInit();
        }
      }, 200);
      setTimeout(() => clearInterval(interval), 10_000);
    }
  }

  const handleEmbeddedSignup = () => {
    if (!window.FB) { setError('Facebook SDK not loaded. Please refresh the page and try again.'); return; }
    if (!sdkConfig) { setError('WhatsApp config not loaded. Please refresh the page and try again.'); return; }
    setError('');
    setMsg('');

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          if (response.status !== 'unknown') {
            setError('WhatsApp connection was cancelled or failed.');
          }
          return;
        }

        setLoading(true);
        apiFetch<Integration & { webhookStatus: string; webhookError: string | null }>(
          '/whatsapp/integration/exchange-token',
          { method: 'POST', body: JSON.stringify({ code }) },
        ).then((result) => {
          setIntegration({ ...result, status: result.webhookStatus as 'active' | 'inactive' | 'error' });
          setMsg(
            result.webhookStatus === 'active'
              ? `Connected: ${result.displayPhoneNumber} (${result.verifiedName}) — webhook active.`
              : `Credentials saved for ${result.displayPhoneNumber}. Webhook registration pending — check status below.`,
          );
        }).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
        }).finally(() => {
          setLoading(false);
        });
      },
      {
        config_id: sdkConfig.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      },
    );
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);
    try {
      const result = await apiFetch<Integration>('/whatsapp/integration', {
        method: 'POST',
        body: JSON.stringify(manual),
      });
      setIntegration(result);
      setMsg('Credentials saved. Use "Register Webhook" to activate.');
      setView('main');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setError('');
    setMsg('');
    setLoading(true);
    try {
      await apiFetch('/whatsapp/integration/register-webhook', { method: 'POST' });
      setIntegration((prev) => prev ? { ...prev, status: 'active' } : prev);
      setMsg('Webhook registered — integration is now active.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Webhook registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect WhatsApp? This will stop the AI agent from receiving messages.')) return;
    setLoading(true);
    try {
      await apiFetch('/whatsapp/integration/webhook', { method: 'DELETE' });
      await apiFetch('/whatsapp/integration', { method: 'DELETE' });
      setIntegration(null);
      setMsg('WhatsApp disconnected.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Disconnect failed.');
    } finally {
      setLoading(false);
    }
  };

  const isActive = integration?.status === 'active';
  const embeddedSignupAvailable = sdkReady && !!sdkConfig?.configId;

  if (view === 'manual') {
    return (
      <div style={pageStyle}>
        <h2 style={{ marginBottom: 4 }}>Manual WhatsApp Setup</h2>
        <p style={{ color: '#718096', marginBottom: 20, fontSize: 14 }}>
          Enter your credentials from the Meta Developer Console.
        </p>

        {error && <p style={errorStyle}>{error}</p>}

        <form onSubmit={handleManualSubmit} style={formStyle}>
          <label style={labelStyle}>WABA ID</label>
          <p style={hintStyle}>Your WhatsApp Business Account ID — a numeric ID from Meta Business Manager (e.g. 123456789012345)</p>
          <input style={inputStyle} value={manual.wabaId} onChange={(e) => setManual((f) => ({ ...f, wabaId: e.target.value }))} required placeholder="123456789012345" pattern="[0-9]+" title="WABA ID must be a numeric ID from Meta Business Manager" />

          <label style={labelStyle}>Phone Number ID</label>
          <p style={hintStyle}>The numeric Phone Number ID from Meta — NOT your actual phone number (e.g. 987654321098765)</p>
          <input style={inputStyle} value={manual.phoneNumberId} onChange={(e) => setManual((f) => ({ ...f, phoneNumberId: e.target.value }))} required placeholder="987654321098765" pattern="[0-9]+" title="Phone Number ID must be a numeric ID from Meta, not your actual phone number" />

          <label style={labelStyle}>Access Token (System User Token)</label>
          <p style={hintStyle}>A permanent System User token from Meta Business Manager — starts with "EAA..."</p>
          <input style={inputStyle} type="password" value={manual.accessToken} onChange={(e) => setManual((f) => ({ ...f, accessToken: e.target.value }))} required placeholder="EAAxxxxxxxxxxxxxxx" />

          <label style={labelStyle}>Webhook Verify Token</label>
          <p style={hintStyle}>A secret string you choose — used to verify webhook callbacks from Meta</p>
          <input style={inputStyle} value={manual.webhookVerifyToken} onChange={(e) => setManual((f) => ({ ...f, webhookVerifyToken: e.target.value }))} required placeholder="any-secret-string-you-choose" />

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={loading} style={primaryBtn}>
              {loading ? 'Saving…' : 'Save Credentials'}
            </button>
            <button type="button" onClick={() => setView('main')} style={ghostBtn}>
              Cancel
            </button>
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

      {/* Current integration status card */}
      {integration && (
        <div style={statusCard(isActive)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {integration.displayPhoneNumber ?? integration.phoneNumberId ?? 'WhatsApp Connected'}
            </span>
            <span style={{ ...statusBadge, background: isActive ? '#c6f6d5' : '#fed7d7', color: isActive ? '#276749' : '#9b2c2c' }}>
              {integration.status}
            </span>
          </div>
          {integration.verifiedName && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4a5568' }}>{integration.verifiedName}</p>
          )}
          {integration.errorMessage && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c53030' }}>{integration.errorMessage}</p>
          )}
          {integration.wabaId && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>WABA: {integration.wabaId}</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!isActive && (
              <button onClick={handleRegisterWebhook} disabled={loading} style={primaryBtn}>
                {loading ? 'Registering…' : 'Register Webhook'}
              </button>
            )}
            <button onClick={() => setView('manual')} disabled={loading} style={ghostBtn}>
              Edit Credentials
            </button>
            <button onClick={handleDisconnect} disabled={loading} style={dangerBtn}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connect section — shown when not connected */}
      {!integration && (
        <div style={connectCard}>
          {embeddedSignupAvailable ? (
            <>
              <p style={{ marginBottom: 16, fontSize: 14, color: '#4a5568' }}>
                Connect your WhatsApp Business account in a few clicks. You'll be guided through
                selecting your business and phone number — no developer console needed.
              </p>
              <button onClick={handleEmbeddedSignup} disabled={loading} style={{ ...primaryBtn, fontSize: 15, padding: '12px 24px' }}>
                {loading ? 'Connecting…' : '🔗  Connect WhatsApp Business'}
              </button>
              <p style={{ marginTop: 16, fontSize: 13, color: '#a0aec0' }}>
                Already have your credentials?{' '}
                <button onClick={() => setView('manual')} style={linkBtn}>
                  Enter them manually
                </button>
              </p>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 16, fontSize: 14, color: '#4a5568' }}>
                Enter your WhatsApp Business credentials from the Meta Developer Console.
              </p>
              <button onClick={() => setView('manual')} style={primaryBtn}>
                Set Up Manually
              </button>
            </>
          )}
        </div>
      )}

      {/* Re-connect option when already connected */}
      {integration && embeddedSignupAvailable && (
        <p style={{ marginTop: 16, fontSize: 13, color: '#a0aec0' }}>
          Need to connect a different number?{' '}
          <button onClick={handleEmbeddedSignup} disabled={loading} style={linkBtn}>
            Re-run WhatsApp setup
          </button>
          {' or '}
          <button onClick={() => setView('manual')} style={linkBtn}>
            update manually
          </button>
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
  padding: 16,
  borderRadius: 8,
  border: `1px solid ${active ? '#9ae6b4' : '#fed7d7'}`,
  background: active ? '#f0fff4' : '#fff5f5',
  marginBottom: 16,
});

const connectCard: React.CSSProperties = {
  padding: 24,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#f7fafc',
};
