import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../api';

// ── Payment method definitions ────────────────────────────────────────────────

type ProviderKey =
  | 'ecocash' | 'onemoney' | 'telecash'
  | 'cbs_bank' | 'steward_bank' | 'fbc_bank' | 'zb_bank' | 'stanbic' | 'nedbank_zw' | 'other_bank'
  | 'innbucks' | 'mukuru' | 'worldremit' | 'paypal' | 'other';

interface ProviderDef {
  label: string;
  group: string;
  accountLabel: string;
  accountPlaceholder: string;
  accountType: 'phone' | 'account' | 'email' | 'text';
  extraFields?: Array<{ key: string; label: string; placeholder: string; required?: boolean }>;
}

const PROVIDERS: Record<ProviderKey, ProviderDef> = {
  // Mobile Money
  ecocash:      { group: 'Mobile Money', label: 'EcoCash',    accountLabel: 'EcoCash Number',    accountPlaceholder: '0771 234 567', accountType: 'phone', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. John Doe', required: true }] },
  onemoney:     { group: 'Mobile Money', label: 'OneMoney',   accountLabel: 'OneMoney Number',   accountPlaceholder: '0712 345 678', accountType: 'phone', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. John Doe', required: true }] },
  telecash:     { group: 'Mobile Money', label: 'TeleCash',   accountLabel: 'TeleCash Number',   accountPlaceholder: '0733 456 789', accountType: 'phone', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. John Doe', required: true }] },
  innbucks:     { group: 'Mobile Money', label: 'InnBucks',   accountLabel: 'InnBucks Number',   accountPlaceholder: '0771 234 567', accountType: 'phone', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. John Doe' }] },
  // Banks
  cbs_bank:     { group: 'Bank Transfer', label: 'CBZ Bank',      accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. Harare Main' }] },
  steward_bank: { group: 'Bank Transfer', label: 'Steward Bank',  accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. Bulawayo' }] },
  fbc_bank:     { group: 'Bank Transfer', label: 'FBC Bank',      accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. Mutare' }] },
  zb_bank:      { group: 'Bank Transfer', label: 'ZB Bank',       accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. Gweru' }] },
  stanbic:      { group: 'Bank Transfer', label: 'Stanbic Bank',  accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. Harare' }] },
  nedbank_zw:   { group: 'Bank Transfer', label: 'Nedbank ZW',    accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. Harare' }] },
  other_bank:   { group: 'Bank Transfer', label: 'Other Bank',    accountLabel: 'Account Number', accountPlaceholder: '1234567890',   accountType: 'account', extraFields: [{ key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. My Bank', required: true }, { key: 'name', label: 'Account Name', placeholder: 'e.g. Acme Ltd', required: true }, { key: 'branch', label: 'Branch', placeholder: 'e.g. City Branch' }] },
  // International / Other
  mukuru:       { group: 'International', label: 'Mukuru',      accountLabel: 'Reference / Phone', accountPlaceholder: '0771 234 567', accountType: 'text', extraFields: [{ key: 'name', label: 'Recipient Name', placeholder: 'e.g. John Doe', required: true }] },
  worldremit:   { group: 'International', label: 'WorldRemit',  accountLabel: 'Phone / Reference', accountPlaceholder: '0771 234 567', accountType: 'text', extraFields: [{ key: 'name', label: 'Recipient Name', placeholder: 'e.g. John Doe', required: true }] },
  paypal:       { group: 'International', label: 'PayPal',      accountLabel: 'PayPal Email',      accountPlaceholder: 'you@example.com', accountType: 'email', extraFields: [{ key: 'name', label: 'Account Name', placeholder: 'e.g. John Doe' }] },
  other:        { group: 'Other',         label: 'Other',       accountLabel: 'Account / Reference', accountPlaceholder: 'e.g. reference number', accountType: 'text', extraFields: [{ key: 'label', label: 'Method Name', placeholder: 'e.g. Paynow, Zimswitch', required: true }, { key: 'instructions', label: 'Instructions (optional)', placeholder: 'e.g. Send to account X, reference your order number' }] },
};

// Group providers for the combobox
const PROVIDER_GROUPS = Array.from(new Set(Object.values(PROVIDERS).map((p) => p.group)));

interface PaymentMethod {
  id: string;
  provider: ProviderKey;
  account: string;
  extras: Record<string, string>;
}

interface PaymentSettingsData {
  inChatPaymentsEnabled: boolean;
  externalPaymentDetails: Record<string, unknown> | null;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function methodsToDetails(methods: PaymentMethod[]): Record<string, unknown> {
  return { methods: methods.map(({ provider, account, extras }) => ({ provider, account, ...extras })) };
}

function detailsToMethods(details: Record<string, unknown> | null): PaymentMethod[] {
  if (!details) return [];
  const raw = details.methods as Array<Record<string, string>> | undefined;
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const { provider, account, ...extras } = m;
    return { id: makeId(), provider: (provider as ProviderKey) || 'other', account: account || '', extras };
  });
}

export default function PaymentSettings() {
  const location = useLocation();
  const fromRevenue = new URLSearchParams(location.search).get('from') === 'revenue';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  // Show methods section if: in-chat payments disabled OR redirected from revenue page
  const showMethods = !enabled || fromRevenue;

  useEffect(() => {
    apiFetch<PaymentSettingsData>('/payments/settings')
      .then((data) => {
        setEnabled(data.inChatPaymentsEnabled);
        setMethods(detailsToMethods(data.externalPaymentDetails));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const addMethod = () => {
    setMethods((m) => [...m, { id: makeId(), provider: 'ecocash', account: '', extras: {} }]);
  };

  const removeMethod = (id: string) => setMethods((m) => m.filter((x) => x.id !== id));

  const updateMethod = (id: string, patch: Partial<PaymentMethod>) =>
    setMethods((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const updateExtra = (id: string, key: string, value: string) =>
    setMethods((m) => m.map((x) => (x.id === id ? { ...x, extras: { ...x.extras, [key]: value } } : x)));

  const hasValidMethod = methods.some((m) => m.account.trim() !== '');
  const canSave = enabled || hasValidMethod;

  const handleSave = async () => {
    setSaveError(null);
    setSuccess(false);
    if (!enabled && !hasValidMethod) {
      setSaveError('Add at least one payment method with an account number when in-chat payments are disabled.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/payments/settings', {
        method: 'PUT',
        body: JSON.stringify({
          inChatPaymentsEnabled: enabled,
          externalPaymentDetails: enabled ? null : methodsToDetails(methods),
        }),
      });
      setSuccess(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading payment settings…</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Payment Settings</h2>

      {fromRevenue && (
        <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#2b6cb0' }}>
          Add your payment details below so customers and the platform know where to send your payouts.
        </div>
      )}

      {/* In-chat payments toggle */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setSaveError(null); setSuccess(false); }}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontWeight: 600 }}>Enable In-Chat Payments (Paynow)</span>
        </label>
        <p style={{ margin: '6px 0 0 30px', color: '#718096', fontSize: 13 }}>
          {enabled
            ? 'Customers will receive a Paynow payment link during checkout.'
            : 'Customers will receive an invoice with your payment details instead.'}
        </p>
      </div>

      {/* External payment methods — always visible when from revenue, or when in-chat disabled */}
      {showMethods && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Payment Methods</h3>
            <button onClick={addMethod} style={addBtn}>+ Add Method</button>
          </div>
          <p style={{ margin: '0 0 16px', color: '#718096', fontSize: 13 }}>
            Add the payment methods customers can use to pay you. These will appear on their invoice.
          </p>

          {methods.length === 0 && (
            <p style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              No payment methods added yet. Click "+ Add Method" to get started.
            </p>
          )}

          {methods.map((method, idx) => {
            const def = PROVIDERS[method.provider];
            return (
              <div key={method.id} style={methodCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#4a5568' }}>Method {idx + 1}</span>
                  <button onClick={() => removeMethod(method.id)} style={removeBtn}>Remove</button>
                </div>

                {/* Provider combobox */}
                <div style={fieldGroup}>
                  <label style={labelStyle}>Payment Provider</label>
                  <select
                    value={method.provider}
                    onChange={(e) => updateMethod(method.id, { provider: e.target.value as ProviderKey, account: '', extras: {} })}
                    style={selectStyle}
                  >
                    {PROVIDER_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {(Object.entries(PROVIDERS) as [ProviderKey, ProviderDef][])
                          .filter(([, d]) => d.group === group)
                          .map(([key, d]) => (
                            <option key={key} value={key}>{d.label}</option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Extra fields first (e.g. bank name, account name) */}
                {def.extraFields?.map((field) => (
                  <div key={field.key} style={fieldGroup}>
                    <label style={labelStyle}>
                      {field.label}{field.required && <span style={{ color: '#e53e3e' }}> *</span>}
                    </label>
                    <input
                      type="text"
                      value={method.extras[field.key] ?? ''}
                      onChange={(e) => updateExtra(method.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={inputStyle}
                    />
                  </div>
                ))}

                {/* Account number / phone / email */}
                <div style={fieldGroup}>
                  <label style={labelStyle}>
                    {def.accountLabel}<span style={{ color: '#e53e3e' }}> *</span>
                  </label>
                  <input
                    type={def.accountType === 'email' ? 'email' : def.accountType === 'phone' ? 'tel' : 'text'}
                    value={method.account}
                    onChange={(e) => updateMethod(method.id, { account: e.target.value })}
                    placeholder={def.accountPlaceholder}
                    style={inputStyle}
                  />
                </div>

                {/* Preview of what customers will see */}
                {method.account.trim() && (
                  <div style={previewBox}>
                    <span style={{ fontSize: 11, color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer Preview</span>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#2d3748' }}>
                      <strong>{def.label}</strong>
                      {method.extras['bank_name'] ? ` — ${method.extras['bank_name']}` : ''}
                      {method.extras['label'] ? ` — ${method.extras['label']}` : ''}
                      {': '}
                      {method.account}
                      {method.extras['name'] ? ` (${method.extras['name']})` : ''}
                      {method.extras['branch'] ? `, ${method.extras['branch']} Branch` : ''}
                    </p>
                    {method.extras['instructions'] && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718096' }}>{method.extras['instructions']}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {saveError && <p style={{ color: '#e53e3e', fontSize: 13, marginBottom: 12 }}>{saveError}</p>}
      {success && <p style={{ color: '#38a169', fontSize: 13, marginBottom: 12 }}>Settings saved successfully.</p>}

      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        style={{ padding: '9px 22px', background: canSave ? '#3182ce' : '#a0aec0', color: '#fff', border: 'none', borderRadius: 6, cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600 }}
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const fieldGroup: React.CSSProperties = { marginBottom: 12 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#4a5568' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none' };
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: '#fff', cursor: 'pointer' };
const methodCard: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 6, padding: 14, marginBottom: 12, background: '#f7fafc' };
const previewBox: React.CSSProperties = { background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 6, padding: '8px 12px', marginTop: 8 };
const addBtn: React.CSSProperties = { padding: '5px 12px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const removeBtn: React.CSSProperties = { padding: '3px 10px', background: 'transparent', color: '#e53e3e', border: '1px solid #feb2b2', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
