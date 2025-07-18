import { Request, Response } from 'express';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { apiKeyService } from '../services/apiKeyService';
import { toConvexId } from '../utils/convexId';

const convex = getConvexClient();

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await convex.query(api.applicationSettings.getAll);
    
    // Filter out sensitive settings
    const safeSettings = settings.filter(s => 
      !s.key.includes('API_KEY') && 
      !s.key.includes('SECRET') &&
      !s.key.includes('TOKEN')
    );
    
    res.json(safeSettings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
}

export async function updateSetting(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Prevent updating sensitive settings through this endpoint
    if (key.includes('API_KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
      res.status(403).json({ error: 'Cannot update sensitive settings through this endpoint' });
      return;
    }
    
    await convex.mutation(api.applicationSettings.upsert, {
      key,
      value,
      description,
      userId: toConvexId<'users'>(req.user.id)
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
}

export async function getApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const settings = await convex.query(api.applicationSettings.getByKeys, {
      keys: ['V2_API_KEY', 'V1_API_KEY']
    });
    
    // Mask the API keys for security
    const maskedKeys = settings.map(setting => ({
      key: setting.key,
      provider: setting.key === 'V2_API_KEY' ? 'v2' : 'v1',
      isSet: !!setting.value,
      lastUpdated: setting.updatedAt,
      // Show only last 4 characters
      maskedValue: setting.value ? `${'*'.repeat(Math.max(0, setting.value.length - 4))}${setting.value.slice(-4)}` : null
    }));
    
    res.json(maskedKeys);
  } catch (error) {
    console.error('Failed to get API keys:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
}

export async function updateApiKey(req: Request, res: Response): Promise<void> {
  try {
    const { provider } = req.params;
    const { apiKey } = req.body;
    
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    if (!['v2', 'v1'].includes(provider)) {
      res.status(400).json({ error: 'Invalid provider. Must be "v2" or "v1"' });
      return;
    }
    
    if (!apiKey || apiKey.trim().length === 0) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }
    
    const key = provider === 'v2' ? 'V2_API_KEY' : 'V1_API_KEY';
    
    // Update in database
    await apiKeyService.updateApiKey(
      key as 'V2_API_KEY' | 'V1_API_KEY',
      apiKey.trim(),
      req.user.id
    );
    
    // Test the API key
    let isValid = false;
    try {
      if (provider === 'v2') {
        // Test V2 API key
        const response = await fetch('https://api.cohere.ai/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Accept': 'application/json'
          }
        });
        isValid = response.ok;
      } else {
        // Test V1 API key
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Accept': 'application/json'
          }
        });
        isValid = response.ok;
      }
    } catch (error) {
      console.error(`Failed to validate ${provider} API key:`, error);
    }
    
    res.json({ 
      success: true,
      provider,
      isValid,
      message: isValid ? 'API key updated and validated successfully' : 'API key updated but validation failed'
    });
  } catch (error) {
    console.error('Failed to update API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
}
