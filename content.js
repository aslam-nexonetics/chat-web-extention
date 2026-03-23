(function() {
  console.log("Nexonetics Chat Extension loaded.");

  // Create Launcher Button
  const launcher = document.createElement('div');
  launcher.id = 'nexonetics-chat-launcher';
  launcher.innerHTML = `<img src="${chrome.runtime.getURL('assets/icons/icon.png')}" alt="Chat">`;
  document.body.appendChild(launcher);

  // Create Chat Window
  const chatContainer = document.createElement('div');
  chatContainer.id = 'nexonetics-chat-container';
  chatContainer.innerHTML = `
    <div id="nexonetics-chat-header">
      <h3>Nexonetics Chat</h3>
      <span id="nexonetics-chat-close">&times;</span>
    </div>
    <div id="nexonetics-chat-body">
      <div class="chat-bubble received">Hello! How can we help you today?</div>
      <div class="chat-bubble sent">I have a question about the onboarding flow.</div>
      <div class="chat-bubble received">Sure, I'd be happy to assist with that!</div>
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
  document.body.appendChild(chatContainer);

  const closeBtn = document.getElementById('nexonetics-chat-close');
  const inputField = document.getElementById('nexonetics-chat-input');
  const sendBtn = document.getElementById('nexonetics-chat-send');
  const chatBody = document.getElementById('nexonetics-chat-body');

  // Toggle Chat Window
  launcher.addEventListener('click', () => {
    chatContainer.classList.toggle('open');
    if (chatContainer.classList.contains('open')) {
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
      }, 300);
    }
  });

  closeBtn.addEventListener('click', () => {
    launcher.click();
  });

  // Handle Send Message
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

  sendBtn.addEventListener('click', sendMessage);
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
})();
