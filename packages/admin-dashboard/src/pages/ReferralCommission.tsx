import { useEffect, useState } from 'react';
import { Settings, TrendingUp, Users, DollarSign, Calendar, Save, AlertCircle } from 'lucide-react';

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

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            Referral Commission Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Manage commission rates and earnings periods for the referral program
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-600 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-blue-900 mb-1">Total Earnings</h3>
          <p className="text-3xl font-bold text-blue-900">
            ${stats?.totalEarningsUsd.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-blue-700 mt-2">System-wide referral earnings</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-600 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-green-900 mb-1">Valid Referrals</h3>
          <p className="text-3xl font-bold text-green-900">
            {stats?.totalValidReferrals || 0}
          </p>
          <p className="text-xs text-green-700 mt-2">Referrals earning commissions</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-purple-900 mb-1">Subscribed Referrals</h3>
          <p className="text-3xl font-bold text-purple-900">
            {stats?.totalSubscribedReferrals || 0}
          </p>
          <p className="text-xs text-purple-700 mt-2">Active subscriptions</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-orange-900 mb-1">Avg per Referral</h3>
          <p className="text-3xl font-bold text-orange-900">
            ${stats?.averageEarningsPerReferral.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-orange-700 mt-2">Average earnings</p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Commission Configuration
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Commission Percentage */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Commission Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium"
                placeholder="10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                %
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Percentage of subscription payments earned as commission (0-100%)
            </p>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Example:</span> With {commissionPercentage}% commission,
                a $100 subscription payment earns ${(commissionPercentage * 1).toFixed(2)} in referral
                commission.
              </p>
            </div>
          </div>

          {/* Earnings Period */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Earnings Period (Months)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                value={earningsPeriodMonths}
                onChange={(e) => setEarningsPeriodMonths(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium"
                placeholder="12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                months
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Duration for which referrers earn commissions from referred businesses (1-60 months)
            </p>
            <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-900">
                <span className="font-semibold">Example:</span> With {earningsPeriodMonths} months,
                referrers earn commissions on all subscription payments made by their referrals for{' '}
                {earningsPeriodMonths} {earningsPeriodMonths === 1 ? 'month' : 'months'} after
                registration.
              </p>
            </div>
          </div>

          {/* Last Updated */}
          {settings && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Last updated:</span>{' '}
                {new Date(settings.updatedAt).toLocaleString()}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                hasChanges && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            {hasChanges && (
              <button
                onClick={() => {
                  if (settings) {
                    setCommissionPercentage(settings.commissionPercentage);
                    setEarningsPeriodMonths(settings.earningsPeriodMonths);
                  }
                }}
                className="px-6 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
        <h3 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          How Referral Commissions Work
        </h3>
        <div className="space-y-2 text-sm text-indigo-800">
          <p>
            • <span className="font-semibold">Commission Rate:</span> Referrers earn a percentage of
            every subscription payment made by businesses they refer.
          </p>
          <p>
            • <span className="font-semibold">Earnings Period:</span> Commissions are earned for a
            specified duration after the referred business registers.
          </p>
          <p>
            • <span className="font-semibold">Automatic Calculation:</span> Earnings are calculated
            automatically when referred businesses make subscription payments.
          </p>
          <p>
            • <span className="font-semibold">Wallet Credit:</span> Commissions are credited to the
            referrer's wallet and can be withdrawn or used for payments.
          </p>
        </div>
      </div>
    </div>
  );
}
