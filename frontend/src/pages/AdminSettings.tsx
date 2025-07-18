import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Settings, 
  Key, 
  Users, 
  Check, 
  X, 
  Shield,
  Save,
  Eye,
  EyeOff,
  Coins
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface ApplicationSetting {
  _id: string;
  key: string;
  value: string;
  description?: string;
  updatedAt: number;
}

interface PendingUser {
  _id: string;
  email: string;
  name: string;
  createdAt: number;
  isApproved: boolean;
  role: 'user' | 'admin';
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'users' | 'currency'>('api-keys');
  const [apiKeys, setApiKeys] = useState({
    V2_API_KEY: '',
    V1_API_KEY: '',
  });
  const [showKeys, setShowKeys] = useState({
    V2_API_KEY: false,
    V1_API_KEY: false,
  });
  const [selectedCurrency, setSelectedCurrency] = useState('GBP');

  // Fetch application settings
  const { data: settings, refetch: refetchSettings } = useQuery<ApplicationSetting[]>({
    queryKey: ['application-settings'],
    queryFn: async () => {
      const response = await api.get('/admin/settings');
      return response.data;
    },
  });

  // Fetch all users
  const { data: users, refetch: refetchUsers } = useQuery<PendingUser[]>({
    queryKey: ['all-users'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data;
    },
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await api.post('/admin/settings', { key, value });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
      refetchSettings();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update settings');
    },
  });

  // Approve user mutation
  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post(`/admin/users/${userId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('User approved successfully');
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve user');
    },
  });

  // Set user role mutation
  const setUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'user' | 'admin' }) => {
      const response = await api.post(`/admin/users/${userId}/role`, { role });
      return response.data;
    },
    onSuccess: () => {
      toast.success('User role updated successfully');
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update user role');
    },
  });

  useEffect(() => {
    if (settings) {
      const cohereKey = settings.find(s => s.key === 'V2_API_KEY');
      const openaiKey = settings.find(s => s.key === 'V1_API_KEY');
      const currencySetting = settings.find(s => s.key === 'CURRENCY');
      
      setApiKeys({
        V2_API_KEY: cohereKey?.value || '',
        V1_API_KEY: openaiKey?.value || '',
      });
      
      setSelectedCurrency(currencySetting?.value || 'GBP');
    }
  }, [settings]);

  const handleSaveApiKeys = () => {
    Object.entries(apiKeys).forEach(([key, value]) => {
      if (value) {
        updateSettingMutation.mutate({ key, value });
      }
    });
  };

  const handleSaveCurrency = () => {
    updateSettingMutation.mutate({ key: 'CURRENCY', value: selectedCurrency });
  };

  const pendingUsers = users?.filter(u => !u.isApproved) || [];
  const approvedUsers = users?.filter(u => u.isApproved) || [];

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('api-keys')}
          className={cn(
            'px-4 py-2 font-medium transition-colors relative',
            activeTab === 'api-keys'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
        >
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </div>
          {activeTab === 'api-keys' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            'px-4 py-2 font-medium transition-colors relative',
            activeTab === 'users'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
            {pendingUsers.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </div>
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('currency')}
          className={cn(
            'px-4 py-2 font-medium transition-colors relative',
            activeTab === 'currency'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
        >
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Currency
          </div>
          {activeTab === 'currency' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Service API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="v2-key">V2 API Key</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input
                    id="v2-key"
                    type={showKeys.V2_API_KEY ? 'text' : 'password'}
                    value={apiKeys.V2_API_KEY}
                    onChange={(e) => setApiKeys({ ...apiKeys, V2_API_KEY: e.target.value })}
                    placeholder="Enter V2 API key"
                  />
                  <button
                    onClick={() => setShowKeys({ ...showKeys, V2_API_KEY: !showKeys.V2_API_KEY })}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {showKeys.V2_API_KEY ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Used for neural embedding-based matching
              </p>
            </div>

            <div>
              <Label htmlFor="v1-key">V1 API Key</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input
                    id="v1-key"
                    type={showKeys.V1_API_KEY ? 'text' : 'password'}
                    value={apiKeys.V1_API_KEY}
                    onChange={(e) => setApiKeys({ ...apiKeys, V1_API_KEY: e.target.value })}
                    placeholder="Enter V1 API key"
                  />
                  <button
                    onClick={() => setShowKeys({ ...showKeys, V1_API_KEY: !showKeys.V1_API_KEY })}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {showKeys.V1_API_KEY ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Used for GPT-based embedding matching
              </p>
            </div>

            <Button 
              onClick={handleSaveApiKeys}
              disabled={updateSettingMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              Save API Keys
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Pending Users */}
          {pendingUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Pending Approval</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Registered {format(new Date(user.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveUserMutation.mutate(user._id)}
                          disabled={approveUserMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved Users */}
          <Card>
            <CardHeader>
              <CardTitle>Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              {approvedUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Role</th>
                        <th className="text-left p-2">Joined</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedUsers.map((user) => (
                        <tr key={user._id} className="border-b">
                          <td className="p-2">{user.name}</td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">
                            <span className={cn(
                              'px-2 py-1 rounded text-xs font-medium',
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            )}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {format(new Date(user.createdAt), 'MMM d, yyyy')}
                          </td>
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUserRoleMutation.mutate({
                                userId: user._id,
                                role: user.role === 'admin' ? 'user' : 'admin',
                              })}
                              disabled={setUserRoleMutation.isPending}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No active users</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Currency Tab */}
      {activeTab === 'currency' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Currency Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="currency">Default Currency</Label>
              <select
                id="currency"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="GBP">£ - British Pound (GBP)</option>
                <option value="USD">$ - US Dollar (USD)</option>
                <option value="EUR">€ - Euro (EUR)</option>
                <option value="JPY">¥ - Japanese Yen (JPY)</option>
                <option value="CNY">¥ - Chinese Yuan (CNY)</option>
                <option value="INR">₹ - Indian Rupee (INR)</option>
                <option value="AUD">A$ - Australian Dollar (AUD)</option>
                <option value="CAD">C$ - Canadian Dollar (CAD)</option>
                <option value="CHF">CHF - Swiss Franc (CHF)</option>
                <option value="HKD">HK$ - Hong Kong Dollar (HKD)</option>
                <option value="SGD">S$ - Singapore Dollar (SGD)</option>
                <option value="SEK">kr - Swedish Krona (SEK)</option>
                <option value="NOK">kr - Norwegian Krone (NOK)</option>
                <option value="NZD">NZ$ - New Zealand Dollar (NZD)</option>
                <option value="MXN">$ - Mexican Peso (MXN)</option>
                <option value="ZAR">R - South African Rand (ZAR)</option>
                <option value="BRL">R$ - Brazilian Real (BRL)</option>
                <option value="RUB">₽ - Russian Ruble (RUB)</option>
                <option value="KRW">₩ - South Korean Won (KRW)</option>
                <option value="TRY">₺ - Turkish Lira (TRY)</option>
                <option value="AED">د.إ - UAE Dirham (AED)</option>
                <option value="SAR">﷼ - Saudi Riyal (SAR)</option>
                <option value="PLN">zł - Polish Złoty (PLN)</option>
                <option value="THB">฿ - Thai Baht (THB)</option>
                <option value="MYR">RM - Malaysian Ringgit (MYR)</option>
                <option value="PHP">₱ - Philippine Peso (PHP)</option>
                <option value="CZK">Kč - Czech Koruna (CZK)</option>
                <option value="HUF">Ft - Hungarian Forint (HUF)</option>
                <option value="RON">lei - Romanian Leu (RON)</option>
                <option value="DKK">kr - Danish Krone (DKK)</option>
                <option value="ILS">₪ - Israeli Shekel (ILS)</option>
                <option value="CLP">$ - Chilean Peso (CLP)</option>
                <option value="ARS">$ - Argentine Peso (ARS)</option>
                <option value="COP">$ - Colombian Peso (COP)</option>
                <option value="PEN">S/ - Peruvian Sol (PEN)</option>
                <option value="UYU">$ - Uruguayan Peso (UYU)</option>
                <option value="VND">₫ - Vietnamese Dong (VND)</option>
                <option value="UAH">₴ - Ukrainian Hryvnia (UAH)</option>
                <option value="GHS">₵ - Ghanaian Cedi (GHS)</option>
                <option value="KES">KSh - Kenyan Shilling (KES)</option>
                <option value="NGN">₦ - Nigerian Naira (NGN)</option>
                <option value="EGP">£ - Egyptian Pound (EGP)</option>
                <option value="MAD">د.م. - Moroccan Dirham (MAD)</option>
                <option value="QAR">﷼ - Qatari Riyal (QAR)</option>
                <option value="KWD">د.ك - Kuwaiti Dinar (KWD)</option>
                <option value="BHD">د.ب - Bahraini Dinar (BHD)</option>
                <option value="OMR">﷼ - Omani Rial (OMR)</option>
              </select>
              <p className="text-sm text-muted-foreground mt-2">
                This currency will be used throughout the application for displaying prices
              </p>
            </div>

            <Button 
              onClick={handleSaveCurrency}
              disabled={updateSettingMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Currency Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}