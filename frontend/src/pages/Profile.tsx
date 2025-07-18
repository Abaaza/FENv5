import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  User, 
  Mail, 
  Lock, 
  Palette, 
  Save,
  Loader2,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuthStore } from '../stores/auth.store';
import { useTheme } from '../providers/theme-provider';

interface ProfileFormData {
  name: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      name: user?.name || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name,
      });
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await api.put('/auth/profile', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Profile updated successfully');
      setUser(data.user);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to change password');
    },
  });

  const handleProfileSubmit = profileForm.handleSubmit((data) => {
    updateProfileMutation.mutate(data);
  });

  const handlePasswordSubmit = passwordForm.handleSubmit((data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    changePasswordMutation.mutate(data);
  });

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...profileForm.register('name', { required: 'Name is required' })}
                    placeholder="Enter your name"
                    className="mt-1"
                  />
                  {profileForm.formState.errors.name && (
                    <p className="text-sm text-red-500 mt-1">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Email</Label>
                  <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">
                    {user?.email || 'No email provided'}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Role: {user?.role}</span>
                </div>

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}
                  className="w-full sm:w-auto"
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...passwordForm.register('currentPassword', { 
                      required: 'Current password is required' 
                    })}
                    placeholder="Enter current password"
                    className="mt-1"
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...passwordForm.register('newPassword', { 
                      required: 'New password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    placeholder="Enter new password"
                    className="mt-1"
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register('confirmPassword', { 
                      required: 'Please confirm your password',
                      validate: (value) => 
                        value === passwordForm.watch('newPassword') || 
                        'Passwords do not match',
                    })}
                    placeholder="Confirm new password"
                    className="mt-1"
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3">Theme</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Select how you want the application to appear
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value as any)}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-all',
                          'hover:border-primary/50',
                          'flex flex-col items-center gap-2',
                          theme === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border'
                        )}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <p>
                    Theme preference is automatically saved and will be applied on your next visit.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}