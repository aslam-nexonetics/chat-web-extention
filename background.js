// background.js - Service Worker for Nexonetics Chat Extension

importScripts('auth.js', 'chat.js');

console.log("Nexonetics Background Worker started.");

let socket = null;
let currentCollectionName = null;
let activePollingChatId = null; // Still keeps track of "active" room for join/leave
let pingInterval = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectWebSocket(collectionName) {
  if (!collectionName) return;

  // If already connected to this collection, do nothing
  if (currentCollectionName === collectionName && socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // If connected to a different collection, close the old one
  if (socket) {
    console.log(`[Socket] Closing connection for ${currentCollectionName} to switch to ${collectionName}`);
    socket.close();
  }

  currentCollectionName = collectionName;

  Auth.getAuthHeader().then(async (header) => {
    try {
      if (!header.Authorization) {
        console.log("[Socket] Postponing connection: Not authenticated");
        return;
      }

      console.log(`[Socket] Fetching WebSocket URL for ${collectionName}...`);
      const response = await fetch(`${Auth.API_BASE_URL}/chat/${collectionName}/chat/websocket/url/`, {
        headers: header
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message || "Failed to get socket URL");
      
      const wsUrl = data.websocket_url;
      console.log(`[Socket] Connecting to fetched URL: ${wsUrl}`);

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log(`[Socket] Connected successfully to ${collectionName}`);
        reconnectAttempts = 0;
        startPing();
        if (activePollingChatId) joinRoom(activePollingChatId);
      };

      socket.onmessage = (event) => {
        try {
          console.log("[Socket] Received raw message:", event.data);
          const message = JSON.parse(event.data);
          
          if (message.type === 'new_message') {
            broadcastToTabs('new_messages', message.chat_id || activePollingChatId, message.message);
          } else if (message.type === 'pong') {
            console.log("[Socket] Pong received");
          }
        } catch (err) {
          console.error("[Socket] Failed to parse message:", err);
        }
      };

      socket.onerror = (err) => console.error("[Socket] Error:", err);
      socket.onclose = () => {
        console.log("[Socket] Connection closed");
        stopPing();
        // Only reconnect if we still have a current collection
        if (currentCollectionName === collectionName) {
          scheduleReconnect(collectionName);
        }
      };

    } catch (err) {
      console.error("[Socket] Connection setup failed:", err);
      if (currentCollectionName === collectionName) {
        scheduleReconnect(collectionName);
      }
    }
  });
}

function scheduleReconnect(collectionName) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("[Socket] Max reconnection attempts reached");
    return;
  }
  reconnectAttempts++;
  const delay = reconnectAttempts * 2000;
  console.log(`[Socket] Reconnecting to ${collectionName} in ${delay}ms (Attempt ${reconnectAttempts})`);
  
  clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(() => connectWebSocket(collectionName), delay);
}

function startPing() {
  stopPing();
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
    }
  }, 30000);
}

function stopPing() {
  if (pingInterval) clearInterval(pingInterval);
}

function joinRoom(chatId) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'join_room', room_id: chatId }));
    console.log(`[Socket] Joined room: ${chatId}`);
  }
}

function leaveRoom(chatId) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'leave_room', room_id: chatId }));
    console.log(`[Socket] Left room: ${chatId}`);
  }
}

function broadcastToTabs(action, chatId, messageData) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: action, 
        chatId: chatId, 
        data: messageData 
      }).catch(() => {});
    });
  });
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    Auth.login(request.email, request.password)
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; 
  }

  if (request.action === 'logout') {
    if (socket) socket.close();
    currentCollectionName = null;
    Auth.logout().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'get_profile') {
    Auth.getAuthHeader().then(header => {
      if (!header.Authorization) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      fetch(`${Auth.API_BASE_URL}/auth/me/`, { headers: header })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (request.action === 'fetch_collections') {
    Chat.fetchCollections()
      .then(collections => sendResponse({ success: true, data: collections }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'fetch_chats') {
    // Connect socket for the requested collection
    connectWebSocket(request.collectionName);
    
    Chat.fetchChatList(request.collectionName)
      .then(chats => sendResponse({ success: true, data: chats }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'fetch_messages') {
    Chat.fetchMessages(request.collectionName, request.chatId)
      .then(messages => sendResponse({ success: true, data: messages }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'send_message') {
    Chat.sendMessage(request.collectionName, request.chatId, request.text)
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'start_polling') {
    activePollingChatId = request.chatId;
    joinRoom(request.chatId);
    sendResponse({ success: true });
  }

  if (request.action === 'stop_polling') {
    if (activePollingChatId) leaveRoom(activePollingChatId);
    activePollingChatId = null;
    sendResponse({ success: true });
  }
});

