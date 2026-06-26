export const endpoints = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    logout: '/api/auth/logout',
  },
  dashboard: {
    stats: '/api/dashboard/stats',
  },
  calls: {
    list: (limit = 50) => `/api/calls?limit=${limit}`,
  },
  tenant: {
    profile: '/api/tenant/profile',
    extensions: '/api/tenant/extensions',
    extension: (id: string) => `/api/tenant/extensions/${id}`,
  },
  softphone: {
    token: '/api/softphone/token',
    config: '/api/softphone/config',
    presence: '/api/softphone/presence',
    callAccepted: '/api/softphone/call-accepted',
    callLog: '/api/softphone/call-log',
  },
  messaging: {
    conversations: '/api/conversations',
    conversationMessages: (id: string) => `/api/conversations/${id}/messages`,
    markRead: (id: string) => `/api/conversations/${id}/read`,
    send: '/api/messages/send',
    attachments: '/api/messages/attachments',
  },
  voicemail: {
    list: (limit = 50) => `/api/tenant/voicemails?limit=${limit}`,
    markRead: (id: string) => `/api/tenant/voicemails/${id}/read`,
  },
} as const;
