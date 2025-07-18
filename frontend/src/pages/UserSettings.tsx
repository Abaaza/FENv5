import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { User, Lock, Mail, Shield, Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuthStore } from '../stores/auth.store';
import { useConvex } from 'convex/react';
import { api as convexApi } from '../../convex/_generated/api';
import { format } from 'date-fns';

export default function UserSettings() {
  const convex = useConvex();
  const user = useAuthStore((state) => state.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Get user activity logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ['user-activity-logs'],
    queryFn: async () => {
      if (!user) return [];
      const logs = await convex.query(convexApi.activityLogs.getByUser, {
        userId: user.id as any,
        limit: 20,
      });
      return logs;
    },
    enabled: !!user,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const response = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to change password');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => {
      toast.error('Failed to change password');
    },
  });

  const handleUpdateProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateProfileMutation.mutate({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
    });
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={user?.name}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user?.email}
                    required
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Role: {user?.role}</span>
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  Update Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    At least 8 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityLogs.length === 0 ? (
                  <p className="text-muted-foreground">No activity logs found</p>
                ) : (
                  activityLogs.map((log) => (
                    <div
                      key={log._id}
                      className="flex items-start justify-between border-b pb-3"
                    >
                      <div>
                        <p className="font-medium">{log.action}</p>
                        {log.details && (
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                        )}
                      </div>
                      <time className="text-sm text-muted-foreground">
                        {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                      </time>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}