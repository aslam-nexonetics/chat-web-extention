const Chat = {
  async fetchCollections() {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/user-collections/my-collections/`, {
        headers: { ...authHeader }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch collections');
      // The API returns a list where each item has a "collection" object
      return data.map(item => item.collection) || [];
    } catch (error) {
      console.error('Fetch collections error:', error);
      throw error;
    }
  },

  async fetchChatList(collectionName) {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${collectionName}/chat/list/`, {
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

  async fetchMessages(collectionName, roomId, page = 1, size = 50) {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${collectionName}/chat/${roomId}/messages/?page=${page}&size=${size}`, {
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

  async sendMessage(collectionName, roomId, text) {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${collectionName}/chat/send/`, {
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
  },

  async fetchAllCollections() {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/user-collections/available-collections/`, {
        headers: { ...authHeader }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch all collections');
      return data || [];
    } catch (error) {
      console.error('Fetch all collections error:', error);
      throw error;
    }
  },

  async joinCollection(collectionId, userId) {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/user-collections/collections/${collectionId}/users/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          collection_id: collectionId,
          role: 'viewer',
          permissions: {},
          user_id: userId
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to join collection');
      return data;
    } catch (error) {
      console.error('Join collection error:', error);
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
