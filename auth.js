const API_BASE_URL = 'https://api3.made2tech.com/api/v1';

const Auth = {
  API_BASE_URL,
  async login(emailOrUsername, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_or_username: emailOrUsername,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Login failed');
      }

      await this.saveTokens(data);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      const tokens = await this.getTokens();
      if (tokens && tokens.access_token) {
        await fetch(`${API_BASE_URL}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearTokens();
    }
  },

  isContextValid() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return true;
    }
    console.warn('Nexonetics: Extension context invalidated. Please refresh the page.');
    return false;
  },

  async saveTokens(tokens) {
    if (!this.isContextValid()) return;
    return new Promise((resolve) => {
      chrome.storage.local.set({ auth_tokens: tokens }, () => {
        resolve();
      });
    });
  },

  async getTokens() {
    if (!this.isContextValid()) return null;
    return new Promise((resolve) => {
      chrome.storage.local.get(['auth_tokens'], (result) => {
        resolve(result?.[ 'auth_tokens' ] || null);
      });
    });
  },

  async clearTokens() {
    if (!this.isContextValid()) return;
    return new Promise((resolve) => {
      chrome.storage.local.remove(['auth_tokens'], () => {
        resolve();
      });
    });
  },

  async isAuthenticated() {
    const tokens = await this.getTokens();
    return !!(tokens && tokens.access_token);
  },

  async getAuthHeader() {
    const tokens = await this.getTokens();
    if (tokens && tokens.access_token) {
      return { 'Authorization': `Bearer ${tokens.access_token}` };
    }
    return {};
  }
};

// Make it available globally in both content script (window) and service worker (self) contexts
if (typeof window !== 'undefined') {
  window.Auth = Auth;
} else if (typeof self !== 'undefined') {
  self.Auth = Auth;
}
