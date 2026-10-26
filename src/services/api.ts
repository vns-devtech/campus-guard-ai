import { MonitoredZone, VideoSourceItem, Incident, SystemSettings, AuditLogItem } from '../types';

export const api = {
  async getSettings(): Promise<SystemSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json();
  },

  async updateSettings(settings: Partial<SystemSettings>, operatorName?: string): Promise<SystemSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, operatorName })
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const data = await res.json();
    return data.settings;
  },

  async getSources(): Promise<VideoSourceItem[]> {
    const res = await fetch('/api/sources');
    if (!res.ok) throw new Error('Failed to load sources');
    return res.json();
  },

  async addSource(source: Partial<VideoSourceItem>): Promise<VideoSourceItem> {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    });
    if (!res.ok) throw new Error('Failed to create source');
    return res.json();
  },

  async getZones(): Promise<MonitoredZone[]> {
    const res = await fetch('/api/zones');
    if (!res.ok) throw new Error('Failed to load zones');
    return res.json();
  },

  async getIncidents(params?: { status?: string; severity?: string; zoneId?: string }): Promise<Incident[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.zoneId) query.append('zoneId', params.zoneId);

    const res = await fetch(`/api/incidents?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load incidents');
    return res.json();
  },

  async createIncident(incident: Partial<Incident>): Promise<Incident> {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident)
    });
    if (!res.ok) throw new Error('Failed to create incident');
    return res.json();
  },

  async updateIncidentStatus(id: string, status: string, reviewedBy: string, notes?: string): Promise<Incident> {
    const res = await fetch(`/api/incidents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewedBy, notes })
    });
    if (!res.ok) throw new Error('Failed to update incident status');
    return res.json();
  },

  async getAnalytics(): Promise<any> {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error('Failed to load analytics');
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await fetch('/api/audit-logs');
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
  },

  async uploadVideo(file: File, zoneId: string): Promise<{ success: boolean; source: VideoSourceItem }> {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        zoneId
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  }
};
