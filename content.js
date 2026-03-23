(function() {
  console.log("Nexonetics Chat Extension loaded.");

  let currentUser = null;

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
    const authenticated = await Auth.isAuthenticated();
    if (authenticated) {
      const success = await fetchUserProfile();
      if (success) {
        showChatView();
      } else {
        await Auth.logout();
        showLoginView();
      }
    } else {
      showLoginView();
    }
  };

  const fetchUserProfile = async () => {
    try {
      const authHeader = await Auth.getAuthHeader();
      const response = await fetch(`${Auth.API_BASE_URL}/auth/me/`, {
        headers: { ...authHeader }
      });
      if (response.ok) {
        currentUser = await response.json();
        return true;
      }
    } catch (err) {
      console.error("Failed to fetch user profile", err);
    }
    return false;
  };

  const handleLogout = async () => {
    await Auth.logout();
    currentUser = null;
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

  const showChatView = async () => {
    chatContainer.innerHTML = `
      <div id="nexonetics-chat-header">
        <div class="nexonetics-user-profile">
          <img src="${currentUser?.avatarUrl || 'https://via.placeholder.com/32'}" alt="Avatar" class="nexonetics-avatar">
          <h3>Chats</h3>
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
      <div id="nexonetics-chat-list">
        <div class="nexonetics-loading-container" style="display: flex; justify-content: center; padding: 40px;">
          <div class="nexonetics-loading-spinner" style="border-top-color: var(--primary-color);"></div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('nexonetics-chat-close');
    const logoutBtn = document.getElementById('nexonetics-logout-btn');
    if (closeBtn) closeBtn.onclick = () => toggleWindow(false);
    if (logoutBtn) logoutBtn.onclick = handleLogout;

    try {
      const chats = await Chat.fetchChatList();
      renderChatList(chats);
    } catch (err) {
      document.getElementById('nexonetics-chat-list').innerHTML = `
        <div id="nexonetics-empty-list">
          <p>Failed to load chats. Please try again.</p>
        </div>
      `;
    }
  };

  const renderChatList = (chats) => {
    const listContainer = document.getElementById('nexonetics-chat-list');
    if (!chats || chats.length === 0) {
      listContainer.innerHTML = `
        <div id="nexonetics-empty-list">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No chats available in ${Chat.COLLECTION}</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = chats.map(chat => `
      <div class="nexonetics-chat-item" data-id="${chat.id}">
        <img src="${chat.avatar_url || 'https://via.placeholder.com/48'}" alt="Avatar" class="nexonetics-avatar">
        <div class="nexonetics-chat-info">
          <div class="nexonetics-chat-name-row">
            <span class="nexonetics-chat-name">${chat.display_name || chat.channel_name}</span>
            <span class="nexonetics-chat-time">${chat.last_activity ? new Date(chat.last_activity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
          </div>
          <div class="nexonetics-chat-snippet">${chat.last_message?.message_text || 'No messages yet'}</div>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.nexonetics-chat-item').forEach(item => {
      item.onclick = () => {
        const chatId = item.getAttribute('data-id');
        const chat = chats.find(c => c.id == chatId);
        showChatRoomView(chat);
      };
    });
  };

  const showChatRoomView = async (room) => {
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
          <img src="${room.avatar_url || 'https://via.placeholder.com/32'}" alt="Avatar" class="nexonetics-avatar">
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
    const chatBody = document.getElementById('nexonetics-chat-body');

    backBtn.onclick = () => {
      roomContainer.classList.remove('active');
      showChatView();
    };
    closeBtn.onclick = () => toggleWindow(false);

    const loadMessages = async () => {
      try {
        const messages = await Chat.fetchMessages(room.id);
        renderMessages(messages);
      } catch (err) {
        chatBody.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Failed to load messages.</p>';
      }
    };

    const renderMessages = (messages) => {
      const sortedMessages = [...messages].reverse();
      chatBody.innerHTML = sortedMessages.map(msg => `
        <div class="chat-bubble ${msg.user_id === currentUser.id ? 'sent' : 'received'}">
          ${msg.message_text}
          <span class="chat-bubble-time">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
      `).join('');
      chatBody.scrollTop = chatBody.scrollHeight;
    };

    const sendMessage = async () => {
      const text = inputField.value.trim();
      if (!text) return;

      inputField.disabled = true;
      sendBtn.style.opacity = '0.5';

      try {
        await Chat.sendMessage(room.id, text);
        inputField.value = '';
        await loadMessages();
      } catch (err) {
        console.error("Failed to send message", err);
      } finally {
        inputField.disabled = false;
        sendBtn.style.opacity = '1';
        inputField.focus();
      }
    };

    sendBtn.onclick = sendMessage;
    inputField.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };

    // Initial load
    await loadMessages();

        // Start polling for new messages (every 5 seconds)
    const pollInterval = setInterval(async () => {
      if (roomContainer.classList.contains('active') && chatContainer.classList.contains('open')) {
        await loadMessages();
      } else {
        clearInterval(pollInterval);
      }
    }, 5000);
  };

  const setupLoginListeners = () => {
    const loginBtn = document.getElementById('nexonetics-login-btn');
    const emailInput = document.getElementById('nexonetics-email');
    const passwordInput = document.getElementById('nexonetics-password');
    const errorMsg = document.getElementById('nexonetics-login-error');
    const closeBtn = document.getElementById('nexonetics-chat-close');

    if (closeBtn) closeBtn.onclick = () => toggleWindow(false);

    loginBtn.onclick = async () => {
      const email_or_username = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email_or_username || !password) return;

      loginBtn.classList.add('nexonetics-loading');
      loginBtn.innerHTML = '<div class="nexonetics-loading-spinner"></div> LOGGING IN...';
      errorMsg.style.display = 'none';

      try {
        await Auth.login(email_or_username, password);
        await fetchUserProfile();
        showChatView();
      } catch (err) {
        errorMsg.textContent = err.message || 'Login failed. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        loginBtn.classList.remove('nexonetics-loading');
        loginBtn.innerHTML = 'Log In';
      }
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

  launcher.onclick = () => toggleWindow();

  initApp();
})();
