(function() {
  console.log("Nexonetics Chat Extension loaded.");

  let currentUser = null;
  let activeChatId = null;
  let activeCollectionName = null;

  const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>`;

  // Helper for messaging
  const sendBackgroundMessage = (message) => {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) {
        handleContextInvalidated();
        return resolve({ success: false, error: 'Context invalidated' });
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message.includes('context invalidated')) {
              handleContextInvalidated();
            }
            return resolve({ success: false, error: chrome.runtime.lastError.message });
          }
          resolve(response);
        });
      } catch (err) {
        if (err.message.includes('context invalidated')) {
          handleContextInvalidated();
        }
        resolve({ success: false, error: err.message });
      }
    });
  };

  const handleContextInvalidated = () => {
    console.warn("Nexonetics: Extension context invalidated. Please refresh the page.");
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:white;display:flex;align-items:center;justify-content:center;z-index:10000;flex-direction:column;font-family:sans-serif;text-align:center;padding:20px;';
    overlay.innerHTML = `
      <h2 style="margin-bottom:10px;">Extension Updated</h2>
      <p style="margin-bottom:20px;">The extension was recently updated or reloaded. To keep using the chat, please refresh this page.</p>
      <button onclick="window.location.reload()" style="padding:10px 20px;background:#007bff;border:none;border-radius:5px;color:white;cursor:pointer;font-weight:bold;">Refresh Now</button>
    `;
    document.body.appendChild(overlay);
  };

  // Create Launcher Button
  const launcher = document.createElement('div');
  launcher.id = 'nexonetics-chat-launcher';
  launcher.innerHTML = `<img src="${chrome.runtime.getURL('assets/icons/icon.png')}" alt="Chat">`;
  document.body.appendChild(launcher);

  // Create Chat Window Container
  const chatContainer = document.createElement('div');
  chatContainer.id = 'nexonetics-chat-container';
  document.body.appendChild(chatContainer);

  const initApp = async () => {
    const response = await sendBackgroundMessage({ action: 'get_profile' });
    if (response && response.success) {
      currentUser = response.data;
      showCollectionsView();
    } else {
      showLoginView();
    }
  };

  const handleLogout = async () => {
    await sendBackgroundMessage({ action: 'logout' });
    currentUser = null;
    activeCollectionName = null;
    showLoginView();
  };

  const showLoginView = () => {
    chatContainer.innerHTML = `
      <div id="nexonetics-login-view">
        <span id="nexonetics-chat-close" style="position: absolute; right: 20px; top: 20px; color: white;">&times;</span>
        <div class="nexonetics-welcome-container">
          <h1 class="nexonetics-welcome-text">Welcome</h1>
          <h1 class="nexonetics-back-text">Back!</h1>
        </div>
        
        <div class="nexonetics-input-group">
          <div class="nexonetics-input-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input type="text" id="nexonetics-email" placeholder="Email or Username">
          </div>
        </div>

        <div class="nexonetics-input-group">
          <div class="nexonetics-input-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input type="password" id="nexonetics-password" placeholder="Password">
          </div>
        </div>

        <button id="nexonetics-login-btn">Log In</button>
        <div id="nexonetics-login-error"></div>
      </div>
    `;
    setupLoginListeners();
  };

  const showCollectionsView = async () => {
    activeCollectionName = null;
    chatContainer.innerHTML = `
      <div id="nexonetics-chat-header">
        <div class="nexonetics-user-profile">
          <img src="${currentUser?.avatarUrl || DEFAULT_AVATAR}" alt="Avatar" class="nexonetics-avatar">
          <h3>Your Collections</h3>
        </div>
        <div id="nexonetics-header-actions">
          <button id="nexonetics-logout-btn" title="Logout">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path>
            </svg>
          </button>
          <span id="nexonetics-chat-close">&times;</span>
        </div>
      </div>
      <div id="nexonetics-collection-list">
        <div class="nexonetics-loading-container" style="display: flex; justify-content: center; padding: 40px;">
          <div class="nexonetics-loading-spinner" style="border-top-color: var(--primary-color);"></div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('nexonetics-chat-close');
    const logoutBtn = document.getElementById('nexonetics-logout-btn');
    if (closeBtn) closeBtn.onclick = () => toggleWindow(false);
    if (logoutBtn) logoutBtn.onclick = handleLogout;

    const response = await sendBackgroundMessage({ action: 'fetch_collections' });
    if (response && response.success) {
      renderCollectionList(response.data);
    } else {
      document.getElementById('nexonetics-collection-list').innerHTML = `
        <div id="nexonetics-empty-list">
          <p>Failed to load collections. Please try again.</p>
        </div>
      `;
    }
  };

  const renderCollectionList = (collections) => {
    const listContainer = document.getElementById('nexonetics-collection-list');
    if (!collections || collections.length === 0) {
      listContainer.innerHTML = `
        <div id="nexonetics-empty-list">
          <p>You haven't joined any collections yet.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = collections.map(col => `
      <div class="nexonetics-collection-item" data-name="${col.collection_name}">
        <div class="nexonetics-collection-icon">${col.collection_name?.charAt(0) || 'C'}</div>
        <div class="nexonetics-collection-info">
          <div class="nexonetics-collection-name">${col.collection_name}</div>
          <div class="nexonetics-collection-desc">${col.description || 'View chats and messages'}</div>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.nexonetics-collection-item').forEach(item => {
      item.onclick = () => {
        const name = item.getAttribute('data-name');
        showChatView(name);
      };
    });
  };

  const showChatView = async (collectionName) => {
    activeCollectionName = collectionName;
    stopPolling(); 
    chatContainer.innerHTML = `
      <div id="nexonetics-chat-header">
        <button class="nexonetics-back-btn" id="nexonetics-back-to-collections">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"></path>
          </svg>
        </button>
        <div class="nexonetics-user-profile">
          <h3>${collectionName} Chats</h3>
        </div>
        <div id="nexonetics-header-actions">
          <span id="nexonetics-chat-close">&times;</span>
        </div>
      </div>
      <div id="nexonetics-chat-list">
        <div class="nexonetics-loading-container" style="display: flex; justify-content: center; padding: 40px;">
          <div class="nexonetics-loading-spinner" style="border-top-color: var(--primary-color);"></div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('nexonetics-chat-close');
    const backBtn = document.getElementById('nexonetics-back-to-collections');
    if (closeBtn) closeBtn.onclick = () => toggleWindow(false);
    if (backBtn) backBtn.onclick = showCollectionsView;

    const response = await sendBackgroundMessage({ action: 'fetch_chats', collectionName });
    if (response && response.success) {
      renderChatList(collectionName, response.data);
    } else {
      document.getElementById('nexonetics-chat-list').innerHTML = `
        <div id="nexonetics-empty-list">
          <p>Failed to load chats for ${collectionName}.</p>
        </div>
      `;
    }
  };

  const renderChatList = (collectionName, chats) => {
    const listContainer = document.getElementById('nexonetics-chat-list');
    if (!chats || chats.length === 0) {
      listContainer.innerHTML = `
        <div id="nexonetics-empty-list">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No chats available in this collection</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = chats.map(chat => `
      <div class="nexonetics-chat-item" data-id="${chat.id}">
        <img src="${chat.avatar_url || DEFAULT_AVATAR}" alt="Avatar" class="nexonetics-avatar">
        <div class="nexonetics-chat-info">
          <div class="nexonetics-chat-name-row">
            <span class="nexonetics-chat-name">${chat.display_name || chat.channel_name}</span>
            <span class="nexonetics-chat-time">${chat.last_activity ? formatTime(chat.last_activity) : ''}</span>
          </div>
          <div class="nexonetics-chat-snippet">${chat.last_message?.message_text || 'No messages yet'}</div>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.nexonetics-chat-item').forEach(item => {
      item.onclick = () => {
        const chatId = item.getAttribute('data-id');
        const chat = chats.find(c => c.id == chatId);
        showChatRoomView(collectionName, chat);
      };
    });
  };

  const showChatRoomView = async (collectionName, room) => {
    activeChatId = room.id;
    // Create or show room container
    let roomContainer = document.getElementById('nexonetics-chat-room-container');
    if (!roomContainer) {
      roomContainer = document.createElement('div');
      roomContainer.id = 'nexonetics-chat-room-container';
      chatContainer.appendChild(roomContainer);
    }
    roomContainer.classList.add('active');

    roomContainer.innerHTML = `
      <div id="nexonetics-chat-header">
        <button class="nexonetics-back-btn" id="nexonetics-back-to-list">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"></path>
          </svg>
        </button>
        <div class="nexonetics-user-profile">
          <img src="${room.avatar_url || DEFAULT_AVATAR}" alt="Avatar" class="nexonetics-avatar">
          <h3>${room.display_name || room.channel_name}</h3>
        </div>
        <span id="nexonetics-chat-close">&times;</span>
      </div>
      <div id="nexonetics-chat-body">
        <div class="nexonetics-loading-container" style="display: flex; justify-content: center; padding: 40px;">
          <div class="nexonetics-loading-spinner" style="border-top-color: var(--primary-color);"></div>
        </div>
      </div>
      <div id="nexonetics-chat-footer">
        <input type="text" id="nexonetics-chat-input" placeholder="Type a message...">
        <button id="nexonetics-chat-send">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
      </div>
    `;

    const backBtn = document.getElementById('nexonetics-back-to-list');
    const closeBtn = roomContainer.querySelector('#nexonetics-chat-close');
    const inputField = document.getElementById('nexonetics-chat-input');
    const sendBtn = document.getElementById('nexonetics-chat-send');

    backBtn.onclick = () => {
      stopPolling();
      roomContainer.classList.remove('active');
      showChatView(collectionName);
    };
    closeBtn.onclick = () => {
      stopPolling();
      toggleWindow(false);
    };

    const loadMessages = async () => {
      const response = await sendBackgroundMessage({ 
        action: 'fetch_messages', 
        collectionName, 
        chatId: room.id 
      });
      if (response && response.success) {
        renderMessages(response.data);
      } else {
        document.getElementById('nexonetics-chat-body').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Failed to load messages.</p>';
      }
    };

    let isSending = false;
    const sendMessage = async () => {
      const text = inputField.value.trim();
      if (!text || isSending) return;

      const originalText = text;
      inputField.value = '';
      inputField.disabled = true;
      sendBtn.style.opacity = '0.5';
      isSending = true;

      const tempMsg = {
        id: 'temp-' + Date.now(),
        message_text: originalText,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        isOptimistic: true
      };
      renderMessages(tempMsg);

      const response = await sendBackgroundMessage({ 
        action: 'send_message', 
        collectionName, 
        chatId: room.id, 
        text: originalText 
      });
      
      if (!response || !response.success) {
        console.error("Failed to send message", response?.error);
        currentMessages = currentMessages.filter(m => m.id !== tempMsg.id);
        renderMessages(currentMessages);
        inputField.value = originalText;
      } else {
        renderMessages(response.data);
      }
      
      isSending = false;
      inputField.disabled = false;
      sendBtn.style.opacity = '1';
      inputField.focus();
    };

    sendBtn.onclick = sendMessage;
    inputField.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };

    await loadMessages();
    startPolling(room.id);
  };

  let currentMessages = [];
  const renderMessages = (data) => {
    const chatBody = document.getElementById('nexonetics-chat-body');
    if (!chatBody) return;

    if (Array.isArray(data)) {
      currentMessages = [...data].reverse();
    } else if (data && typeof data === 'object') {
      const optimisticIndex = currentMessages.findIndex(m => m.isOptimistic && m.message_text === data.message_text);
      if (optimisticIndex !== -1) {
        currentMessages[optimisticIndex] = data; 
      } else if (!currentMessages.some(m => m.id === data.id)) {
        currentMessages.push(data);
      }
    }

    chatBody.innerHTML = currentMessages.map(msg => `
      <div class="chat-bubble ${msg.user_id === currentUser.id ? 'sent' : 'received'} ${msg.isOptimistic ? 'optimistic' : ''}">
        ${msg.message_text}
        <span class="chat-bubble-time">${msg.isOptimistic ? 'Sending...' : formatTime(msg.created_at)}</span>
      </div>
    `).join('');
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const startPolling = (chatId) => {
    sendBackgroundMessage({ action: 'start_polling', chatId });
  };

  const stopPolling = () => {
    activeChatId = null;
    currentMessages = [];
    sendBackgroundMessage({ action: 'stop_polling' });
  };

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'new_messages' && message.chatId === activeChatId) {
      renderMessages(message.data);
    }
  });

  const setupLoginListeners = () => {
    const loginBtn = document.getElementById('nexonetics-login-btn');
    const emailInput = document.getElementById('nexonetics-email');
    const passwordInput = document.getElementById('nexonetics-password');
    const errorMsg = document.getElementById('nexonetics-login-error');
    const closeBtn = document.getElementById('nexonetics-chat-close');

    if (closeBtn) closeBtn.onclick = () => toggleWindow(false);

    loginBtn.onclick = async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) return;

      loginBtn.classList.add('nexonetics-loading');
      loginBtn.innerHTML = '<div class="nexonetics-loading-spinner"></div> LOGGING IN...';
      errorMsg.style.display = 'none';

      const response = await sendBackgroundMessage({ action: 'login', email, password });
      if (response && response.success) {
        const profileRes = await sendBackgroundMessage({ action: 'get_profile' });
        currentUser = profileRes.data;
        showCollectionsView();
      } else {
        errorMsg.textContent = response?.error || 'Login failed. Please try again.';
        errorMsg.style.display = 'block';
      }
      
      loginBtn.classList.remove('nexonetics-loading');
      loginBtn.innerHTML = 'Log In';
    };
  };

  const toggleWindow = (forceOpen) => {
    const isOpen = chatContainer.classList.contains('open');
    const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;

    if (shouldOpen) {
      chatContainer.classList.add('open');
      chatContainer.style.display = 'flex';
      setTimeout(() => {
        chatContainer.style.opacity = '1';
        chatContainer.style.transform = 'translateY(0)';
      }, 10);
    } else {
      chatContainer.style.opacity = '0';
      chatContainer.style.transform = 'translateY(20px)';
      setTimeout(() => {
        chatContainer.style.display = 'none';
        chatContainer.classList.remove('open');
      }, 300);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const cleanDateStr = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const date = new Date(cleanDateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  launcher.onclick = () => toggleWindow();

  initApp();
})();
