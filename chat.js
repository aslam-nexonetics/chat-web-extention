const Chat = {
  COLLECTION: 'Nexonetics',

  async fetchChatList() {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${this.COLLECTION}/chat/list/`, {
        headers: { ...authHeader }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch chats');
      return data.data || [];
    } catch (error) {
      console.error('Fetch chats error:', error);
      throw error;
    }
  },

  async fetchMessages(roomId, page = 1, size = 50) {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${this.COLLECTION}/chat/${roomId}/messages/?page=${page}&size=${size}`, {
        headers: { ...authHeader }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch messages');
      return data.data || [];
    } catch (error) {
      console.error('Fetch messages error:', error);
      throw error;
    }
  },

  async sendMessage(roomId, text) {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${this.COLLECTION}/chat/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          chat_id: roomId,
          message_text: text,
          message_type: 'text'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send message');
      return data.message;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }
};

// Make it available globally in both content script (window) and service worker (self) contexts
if (typeof window !== 'undefined') {
  window.Chat = Chat;
} else if (typeof self !== 'undefined') {
  self.Chat = Chat;
}
