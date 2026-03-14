// Inbox JS

let currentConversationId = null;

async function loadInboxConversations() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch('/api/inbox', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error("Failed to load conversations");

        const data = await response.json();
        const listEl = document.getElementById('conversationList');
        
        if (!data.conversations || data.conversations.length === 0) {
            listEl.innerHTML = '<p class="loading-text">No conversations found.</p>';
            return;
        }

        listEl.innerHTML = ''; // Clear loading text

        data.conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
            item.onclick = () => selectConversation(conv.id, conv.customer_name, conv.platform);
            
            let icon = '💬';
            if (conv.platform === 'facebook') icon = '📘';
            if (conv.platform === 'instagram') icon = '📸';
            if (conv.platform === 'whatsapp') icon = '📗';

            const dateStr = new Date(conv.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            item.innerHTML = `
                <div class="conversation-header">
                    <span class="conversation-name">${conv.customer_name || 'Unknown User'}</span>
                    <span class="conversation-platform platform-${conv.platform}">${icon}</span>
                </div>
                <div class="conversation-last-msg">${conv.last_message || 'No messages yet'}</div>
                <div style="font-size: 10px; color: #9ca3af; text-align: right; margin-top: 4px;">${dateStr}</div>
            `;
            
            listEl.appendChild(item);
        });
        
    } catch (err) {
        console.error("Inbox load error:", err);
        document.getElementById('conversationList').innerHTML = '<p class="loading-text" style="color: red;">Error loading inbox</p>';
    }
}

async function selectConversation(id, name, platform) {
    currentConversationId = id;
    loadInboxConversations(); // Re-render to show active state
    
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.style.display = 'flex';
    
    document.getElementById('chatCustomerName').innerText = name + ` (${platform})`;
    
    let icon = '💬';
    if (platform === 'facebook') icon = '📘';
    if (platform === 'instagram') icon = '📸';
    if (platform === 'whatsapp') icon = '📗';
    
    document.getElementById('chatPlatformIcon').innerText = icon;
    
    await loadMessages(id);
}

async function loadMessages(conversationId) {
    const token = localStorage.getItem("token");
    const msgsEl = document.getElementById('chatMessages');
    msgsEl.innerHTML = '<div class="loading-text" style="text-align:center; padding: 20px;">Loading messages...</div>';

    try {
        const response = await fetch(`/api/inbox/${conversationId}/messages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error("Failed to load messages");

        const data = await response.json();
        
        if (!data.messages || data.messages.length === 0) {
            msgsEl.innerHTML = '<div class="loading-text" style="text-align:center; padding: 20px;">No messages found in this conversation.</div>';
            return;
        }

        msgsEl.innerHTML = '';
        data.messages.forEach(msg => {
            const bubble = document.createElement('div');
            const isBusiness = msg.sender_type === 'business';
            
            bubble.className = `message-bubble ${isBusiness ? 'message-business' : 'message-customer'}`;
            
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let statusIcon = '';
            
            if (isBusiness) {
                if (msg.status === 'sent') statusIcon = '✓';
                if (msg.status === 'delivered') statusIcon = '✓✓';
                if (msg.status === 'read') statusIcon = '<span style="color:#a5f3fc">✓✓</span>';
            }

            bubble.innerHTML = `
                ${msg.message_text}
                <div class="message-time">
                    ${timeStr} <span class="message-status">${statusIcon}</span>
                </div>
            `;
            
            msgsEl.appendChild(bubble);
        });
        
        // Scroll to bottom
        msgsEl.scrollTop = msgsEl.scrollHeight;

    } catch (err) {
        console.error("Messages load error:", err);
        msgsEl.innerHTML = '<div style="text-align:center; padding: 20px; color: red;">Error loading messages</div>';
    }
}

async function sendReply() {
    if (!currentConversationId) return;
    
    const inputEl = document.getElementById('replyMessage');
    const message = inputEl.value.trim();
    if (!message) return;

    const token = localStorage.getItem("token");
    inputEl.value = ''; // clear input immediately
    inputEl.disabled = true;

    // Optimistically add message
    const msgsEl = document.getElementById('chatMessages');
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble message-business';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `
        ${message}
        <div class="message-time">
            ${timeStr} <span class="message-status">...</span>
        </div>
    `;
    msgsEl.appendChild(bubble);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
        const response = await fetch('/api/inbox/reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                conversationId: currentConversationId,
                message: message
            })
        });

        if (!response.ok) throw new Error("Reply failed");
        
        // Reload all messages to get correct status & IDs
        await loadMessages(currentConversationId);
        await loadInboxConversations();

    } catch (err) {
        console.error("Send reply error:", err);
        alert("Failed to send message: " + err.message);
        bubble.querySelector('.message-status').innerText = '❌';
        bubble.querySelector('.message-status').style.color = '#fca5a5';
    } finally {
        inputEl.disabled = false;
        inputEl.focus();
    }
}

// Initial load hook
document.addEventListener('DOMContentLoaded', () => {
    // Only fetch if we are actually on a page with the inbox
    if (document.getElementById('conversationList')) {
        loadInboxConversations();
        checkConnectionStatus();
        
        // Refresh inbox list periodically (e.g. every 10 seconds)
        setInterval(() => {
            loadInboxConversations();
            if (currentConversationId) {
                loadMessages(currentConversationId); 
            }
        }, 10000);
    }
});

async function checkConnectionStatus() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch('/api/inbox/connections', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const connections = data.connections || [];

        const metaConnected = connections.find(c => c.platform === 'meta' && c.connected);

        const btnFb = document.getElementById('btnConnectFb');
        const btnWa = document.getElementById('btnConnectWa');
        const statusEl = document.getElementById('connectedStatus');

        if (metaConnected) {
            // Hide connect buttons, show connected status
            if (btnFb) btnFb.style.display = 'none';
            if (btnWa) btnWa.style.display = 'none';

            if (statusEl) {
                const connDate = new Date(metaConnected.connected_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                statusEl.style.display = 'flex';
                statusEl.style.gap = '12px';
                statusEl.style.flexWrap = 'wrap';
                statusEl.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; padding:12px 18px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; flex:1;">
                        <span style="font-size:20px;">📘</span>
                        <div>
                            <strong style="color:#166534;">Facebook & Instagram</strong>
                            <div style="font-size:12px; color:#4ade80;">✅ Connected on ${connDate}</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; padding:12px 18px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; flex:1;">
                        <span style="font-size:20px;">📗</span>
                        <div>
                            <strong style="color:#166534;">WhatsApp Business</strong>
                            <div style="font-size:12px; color:#4ade80;">✅ Connected on ${connDate}</div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error("Connection status check failed:", err);
    }
}

async function connectFacebook() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please login first to connect platforms");
        return;
    }
    
    try {
        const response = await fetch('/api/inbox/auth/meta', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error("Missing auth URL");
        }
    } catch(err) {
        console.error("Connection failed", err);
        alert("Failed to initiate connection: " + err.message);
    }
}

async function connectWhatsApp() {
    // Both use the same Meta OAuth flow 
    connectFacebook();
}

