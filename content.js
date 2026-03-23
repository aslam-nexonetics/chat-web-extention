(function() {
  const API_BASE_URL = 'https://api3.made2tech.com/api/v1';
  console.log("Nexonetics Chat Extension loaded.");

  let authToken = null;
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
    chrome.storage.local.get(['access_token'], async (result) => {
      if (result.access_token) {
        authToken = result.access_token;
        const success = await fetchUserProfile();
        if (success) {
          showChatView();
        } else {
          handleLogout();
        }
      } else {
        showLoginView();
      }
    });
  };

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
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

  const handleLogout = () => {
    chrome.storage.local.remove(['access_token', 'refresh_token'], () => {
      authToken = null;
      currentUser = null;
      showLoginView();
    });
  };

  const showLoginView = () => {
    chatContainer.innerHTML = `
      <div id="nexonetics-chat-header">
        <h3>Nexonetics Login</h3>
        <span id="nexonetics-chat-close">&times;</span>
      </div>
      <div id="nexonetics-login-view">
        <h2>Welcome Back</h2>
        <p>Please login to your account to continue</p>
        <div class="nexonetics-input-group">
          <label>Email or Username</label>
          <input type="text" id="nexonetics-email" placeholder="Enter your email or username">
        </div>
        <div class="nexonetics-input-group">
          <label>Password</label>
          <input type="password" id="nexonetics-password" placeholder="••••••••">
        </div>
        <button id="nexonetics-login-btn">Login</button>
        <div id="nexonetics-login-error">Invalid credentials. Please try again.</div>
      </div>
    `;
    setupLoginListeners();
  };

  const showChatView = () => {
    const avatar = currentUser?.avatarUrl || 'https://via.placeholder.com/32';
    const name = currentUser?.fullName || currentUser?.username || 'User';

    chatContainer.innerHTML = `
      <div id="nexonetics-chat-header">
        <div class="nexonetics-user-profile">
          <img src="${avatar}" alt="Avatar" class="nexonetics-avatar">
          <h3>${name}</h3>
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
      <div id="nexonetics-chat-body">
        <div class="chat-bubble received">Hello ${name}! How can we help you today?</div>
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
    setupChatListeners();
  };

  const setupLoginListeners = () => {
    const loginBtn = document.getElementById('nexonetics-login-btn');
    const emailInput = document.getElementById('nexonetics-email');
    const passwordInput = document.getElementById('nexonetics-password');
    const errorMsg = document.getElementById('nexonetics-login-error');
    const closeBtn = document.getElementById('nexonetics-chat-close');

    closeBtn.onclick = () => toggleWindow(false);

    loginBtn.onclick = async () => {
      const email_or_username = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email_or_username || !password) return;

      loginBtn.classList.add('nexonetics-loading');
      loginBtn.textContent = 'Logging in...';
      errorMsg.style.display = 'none';

      try {
        const response = await fetch(`${API_BASE_URL}/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_or_username, password })
        });

        const data = await response.json();

        if (response.ok && data.access_token) {
          chrome.storage.local.set({ 
            access_token: data.access_token,
            refresh_token: data.refresh_token
          }, async () => {
            authToken = data.access_token;
            await fetchUserProfile();
            showChatView();
          });
        } else {
          errorMsg.textContent = data.detail || data.message || 'Login failed';
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'Connection error. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        loginBtn.classList.remove('nexonetics-loading');
        loginBtn.textContent = 'Login';
      }
    };
  };

  const setupChatListeners = () => {
    const closeBtn = document.getElementById('nexonetics-chat-close');
    const logoutBtn = document.getElementById('nexonetics-logout-btn');
    const inputField = document.getElementById('nexonetics-chat-input');
    const sendBtn = document.getElementById('nexonetics-chat-send');
    const chatBody = document.getElementById('nexonetics-chat-body');

    closeBtn.onclick = () => toggleWindow(false);
    logoutBtn.onclick = handleLogout;

    const sendMessage = () => {
      const text = inputField.value.trim();
      if (text) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble sent';
        bubble.textContent = text;
        chatBody.appendChild(bubble);
        inputField.value = '';
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    };

    sendBtn.onclick = sendMessage;
    inputField.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
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
