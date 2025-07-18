import { Request, Response } from 'express';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { logActivity } from '../utils/activityLogger';
import { toConvexId } from '../utils/convexId';

const convex = getConvexClient();

export async function getAllClients(_req: Request, res: Response): Promise<void> {
  try {
    const clients = await convex.query(api.clients.getAll);
    console.log('Backend fetched clients:', clients.length, 'clients');
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
}

export async function getActiveClients(_req: Request, res: Response): Promise<void> {
  try {
    const clients = await convex.query(api.clients.getActive);
    res.json(clients);
  } catch (error) {
    console.error('Get active clients error:', error);
    res.status(500).json({ error: 'Failed to get active clients' });
  }
}

export async function createClient(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, email, phone, address, contactPerson, notes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const clientId = await convex.mutation(api.clients.create, {
      name,
      email,
      phone,
      address,
      contactPerson,
      notes,
      isActive: true, // Keep for backward compatibility
      userId: req.user.id as any,
    });

    // Log activity
    await logActivity(req, 'created_client', 'clients', clientId, `Created client: ${name}`);

    const client = await convex.query(api.clients.getById, { _id: clientId });
    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    await convex.mutation(api.clients.update, {
      _id: id as any,
      ...updates,
    });

    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    console.log('=== DELETE CLIENT REQUEST ===');
    console.log('Client ID:', id);
    console.log('Client ID type:', typeof id);
    console.log('Client ID length:', id.length);

    // Validate the client ID format
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid client ID' });
      return;
    }

    // For now, always use the fallback approach since deleteClient is not in the generated API
    console.log('Using fallback approach to delete client');
    
    try {
      // First check if the client exists
      const client = await convex.query(api.clients.getById, { _id: id as any });
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      
      // Mark client as inactive
      await convex.mutation(api.clients.update, {
        _id: id as any,
        isActive: false,
      });
      console.log('âœ… Client marked as inactive');
      
      res.json({ message: 'Client deleted successfully' });
    } catch (updateError: any) {
      console.error('âŒ Error:', updateError.message);
      
      // Check if it's a Convex ID format error
      if (updateError.message?.includes('Invalid argument') || 
          updateError.message?.includes('Expected Id')) {
        res.status(400).json({ error: 'Invalid client ID format' });
      } else {
        throw updateError;
      }
    }
  } catch (error: any) {
    console.error('=== DELETE CLIENT ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete client' });
  }
}
