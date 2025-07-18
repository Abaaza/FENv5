import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Phone, Mail, MapPin, User, Building } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../lib/api';

interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  createdAt: number;
}

export default function Clients() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    notes: '',
  });

  // Fetch clients
  const { data: clients = [], isLoading, refetch, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await api.get('/clients');
      console.log('Fetched clients:', response.data);
      return response.data;
    },
  });

  // Log any fetch errors
  if (error) {
    console.error('Error fetching clients:', error);
  }

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/clients', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      refetch(); // Force refetch
      toast.success('Client created successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create client');
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await api.patch(`/clients/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      refetch(); // Force refetch
      toast.success('Client updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update client');
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/clients/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['convex-clients'] }); // Also invalidate convex cache
      refetch(); // Force refetch
      toast.success('Client deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete client');
    },
  });

  // Get matching jobs count for each client
  // Since we can't use Convex directly, let's manually count from displayed jobs
  const { data: allJobs = [] } = useQuery({
    queryKey: ['all-matching-jobs'],
    queryFn: async () => {
      try {
        // Fetch all jobs to count by client
        const response = await api.get('/price-matching/all-jobs');
        const allJobs = response.data || [];
        
        console.log('[Clients] Fetched all jobs:', allJobs);
        // Log the first job to see its structure
        if (allJobs.length > 0) {
          console.log('[Clients] First job structure:', allJobs[0]);
        }
        
        return allJobs;
      } catch (error) {
        console.error('Error fetching jobs:', error);
        return [];
      }
    },
  });

  // Group jobs by client ID first, then map to names
  const jobsByClient = React.useMemo(() => {
    // First group by client ID
    const groupedById: Record<string, number> = {};
    allJobs.forEach((job: any) => {
      const clientId = job.clientId;
      if (clientId) {
        groupedById[clientId] = (groupedById[clientId] || 0) + 1;
      }
    });
    
    // Then map IDs to names
    const groupedByName: Record<string, number> = {};
    clients.forEach((client: Client) => {
      const count = groupedById[client._id] || 0;
      if (count > 0) {
        groupedByName[client.name] = count;
      }
    });
    
    console.log('[Clients] Jobs grouped by ID:', groupedById);
    console.log('[Clients] Jobs grouped by name:', groupedByName);
    console.log('[Clients] Client mapping:', clients.map((c: Client) => ({ id: c._id, name: c.name })));
    
    return groupedByName;
  }, [allJobs, clients]);

  const getProjectsCount = (clientName: string) => {
    console.log('[Clients] Getting project count for:', clientName, 'Result:', jobsByClient[clientName]);
    return jobsByClient[clientName] || 0;
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        contactPerson: client.contactPerson || '',
        notes: client.notes || '',
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        contactPerson: '',
        notes: '',
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      contactPerson: '',
      notes: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Client name is required');
      return;
    }

    if (editingClient) {
      updateClientMutation.mutate({
        id: editingClient._id,
        data: formData,
      });
    } else {
      createClientMutation.mutate(formData);
    }
  };

  const handleDelete = (client: Client) => {
    if (window.confirm(`Are you sure you want to delete ${client.name}? This action cannot be undone.`)) {
      deleteClientMutation.mutate(client._id);
    }
  };

  const filteredClients = clients.filter((client: Client) => {
    // Filter out inactive clients (for backward compatibility until Convex is redeployed)
    // This ensures clients marked as inactive via the fallback mechanism are hidden
    if ('isActive' in client && client.isActive === false) return false;
    
    return client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
  });


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>


      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Clients Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading clients...</div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            {searchTerm ? 'No clients match your search' : 'No clients found. Create your first client!'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client: Client) => (
            <Card key={client._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDialog(client)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(client)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.contactPerson && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{client.contactPerson}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${client.phone}`} className="hover:underline">
                      {client.phone}
                    </a>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">{client.address}</span>
                  </div>
                )}
                <div className="pt-2 text-sm text-muted-foreground">
                  {getProjectsCount(client.name)} projects
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Client Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
              />
            </div>

            <div>
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Enter contact person name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createClientMutation.isPending || updateClientMutation.isPending}
            >
              {editingClient ? 'Update Client' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}