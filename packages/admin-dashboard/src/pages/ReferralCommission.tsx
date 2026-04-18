import { useEffect, useState } from 'react';
import { Settings, TrendingUp, Users, DollarSign, Calendar, Save, AlertCircle, Sparkles, Info, CheckCircle2, XCircle } from 'lucide-react';

interface CommissionSettings {
  commissionPercentage: number;
  earningsPeriodMonths: number;
  updatedAt: string;
}

interface SystemStats {
  totalEarningsUsd: number;
  totalValidReferrals: number;
  totalSubscribedReferrals: number;
  averageEarningsPerReferral: number;
}

export default function ReferralCommission() {
  const [settings, setSettings] = useState<CommissionSettings | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [commissionPercentage, setCommissionPercentage] = useState<number>(10);
  const [earningsPeriodMonths, setEarningsPeriodMonths] = useState<number>(12);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('operatorToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Fetch settings
      const settingsResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/referral-commission/settings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch settings');
      }

      const settingsData = await settingsResponse.json();
      setSettings(settingsData);
      setCommissionPercentage(settingsData.commissionPercentage);
      setEarningsPeriodMonths(settingsData.earningsPeriodMonths);

      // Fetch stats
      const statsResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/referral-commission/system-stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('operatorToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/referral-commission/settings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commissionPercentage,
            earningsPeriodMonths,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      setSuccess('Settings updated successfully!');

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    settings &&
    (commissionPercentage !== settings.commissionPercentage ||
      earningsPeriodMonths !== settings.earningsPeriodMonths);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0 left-0"></div>
        </div>
        <p className="mt-4 text-gray-600 font-medium">Loading commission settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header with Gradient Background */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Referral Commission Settings</h1>
                <p className="text-blue-100 mt-1 text-lg">
                  Configure and manage your referral program rewards
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="bg-white border-l-4 border-red-500 rounded-2xl p-5 flex items-start gap-4 shadow-lg">
            <div className="p-2 bg-red-100 rounded-xl">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-900 text-lg">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-white border-l-4 border-green-500 rounded-2xl p-5 flex items-start gap-4 shadow-lg">
            <div className="p-2 bg-green-100 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-green-900 text-lg">Success</h3>
              <p className="text-green-700 mt-1">{success}</p>
            </div>
          </div>
        )}

        {/* Statistics Cards with Enhanced Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Earnings Card */}
          <div className="group relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-blue-100">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 rounded-3xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  USD
                </div>
              </div>
              <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Total Earnings</h3>
              <p className="text-4xl font-black text-gray-900 mb-2">
                ${stats?.totalEarningsUsd.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-gray-600">System-wide referral earnings</p>
            </div>
          </div>

          {/* Valid Referrals Card */}
          <div className="group relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-green-100">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/5 rounded-3xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  Active
                </div>
              </div>
              <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Valid Referrals</h3>
              <p className="text-4xl font-black text-gray-900 mb-2">
                {stats?.totalValidReferrals || 0}
              </p>
              <p className="text-sm text-gray-600">Referrals earning commissions</p>
            </div>
          </div>

          {/* Subscribed Referrals Card */}
          <div className="group relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-purple-100">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 rounded-3xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  Growth
                </div>
              </div>
              <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Subscribed</h3>
              <p className="text-4xl font-black text-gray-900 mb-2">
                {stats?.totalSubscribedReferrals || 0}
              </p>
              <p className="text-sm text-gray-600">Active subscriptions</p>
            </div>
          </div>

          {/* Average per Referral Card */}
          <div className="group relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-orange-100">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-orange-600/5 rounded-3xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                  Avg
                </div>
              </div>
              <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Per Referral</h3>
              <p className="text-4xl font-black text-gray-900 mb-2">
                ${stats?.averageEarningsPerReferral.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-gray-600">Average earnings</p>
            </div>
          </div>
        </div>

        {/* Settings Form with Modern Design */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Commission Configuration</h2>
                <p className="text-blue-100 text-sm mt-0.5">Adjust rates and periods for your referral program</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Commission Percentage */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  Commission Percentage
                </label>
                <span className="text-sm text-gray-500 font-medium">0-100%</span>
              </div>
              <div className="relative group">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-6 py-5 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-2xl font-bold transition-all group-hover:border-gray-300"
                  placeholder="10.0"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-2xl font-black text-gray-400">%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-gray-400" />
                <span>Percentage of subscription payments earned as commission</span>
              </p>
              <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Example Calculation</p>
                    <p className="text-sm text-blue-800">
                      With <span className="font-bold">{commissionPercentage}%</span> commission, a <span className="font-bold">$100</span> subscription payment earns{' '}
                      <span className="font-bold text-blue-600">${(commissionPercentage * 1).toFixed(2)}</span> in referral commission.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings Period */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Earnings Period
                </label>
                <span className="text-sm text-gray-500 font-medium">1-60 months</span>
              </div>
              <div className="relative group">
                <input
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  value={earningsPeriodMonths}
                  onChange={(e) => setEarningsPeriodMonths(parseInt(e.target.value) || 1)}
                  className="w-full px-6 py-5 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 text-2xl font-bold transition-all group-hover:border-gray-300"
                  placeholder="12"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <span className="text-lg font-bold text-gray-400">months</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-gray-400" />
                <span>Duration for which referrers earn commissions from referred businesses</span>
              </p>
              <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-900 mb-1">Example Timeline</p>
                    <p className="text-sm text-purple-800">
                      With <span className="font-bold">{earningsPeriodMonths} {earningsPeriodMonths === 1 ? 'month' : 'months'}</span>, referrers earn commissions on all subscription payments made by their referrals for the entire duration after registration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Last Updated */}
            {settings && (
              <div className="pt-6 border-t-2 border-gray-100">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold text-gray-700">Last updated:</span>
                  </div>
                  <span className="text-gray-600">{new Date(settings.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all text-base shadow-lg ${
                  hasChanges && !saving
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>

              {hasChanges && !saving && (
                <button
                  onClick={() => {
                    if (settings) {
                      setCommissionPercentage(settings.commissionPercentage);
                      setEarningsPeriodMonths(settings.earningsPeriodMonths);
                    }
                  }}
                  className="px-8 py-4 rounded-2xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all border-2 border-gray-300 hover:border-gray-400"
                >
                  Reset Changes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Panel with Modern Design */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">How Referral Commissions Work</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Commission Rate</h4>
                    <p className="text-sm text-white/90">Referrers earn a percentage of every subscription payment made by businesses they refer.</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Earnings Period</h4>
                    <p className="text-sm text-white/90">Commissions are earned for a specified duration after the referred business registers.</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Automatic Calculation</h4>
                    <p className="text-sm text-white/90">Earnings are calculated automatically when referred businesses make subscription payments.</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Wallet Credit</h4>
                    <p className="text-sm text-white/90">Commissions are credited to the referrer's wallet and can be withdrawn or used for payments.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
