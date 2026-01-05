// Connection Status UI Updates
import { state } from '../state.js';
import { handleCopyCode } from './clipboardUtils.js';

export function updateConnectionStatus(isConnected, shareCode = null, statusText = null) {
    const statusEl = document.getElementById('connection-status');
    const dotEl = document.getElementById('connection-dot');
    const textEl = document.getElementById('connection-text');
    const codeEl = document.getElementById('share-code-display');
    const copyBtn = document.getElementById('btn-copy-code');
    const btnEl = document.getElementById('btn-collaborate');
    
    if (!statusEl || !dotEl || !textEl || !btnEl) return;
    
    // Get peer count
    const peerCount = state.connectedPeers.size;
    const peerList = Array.from(state.connectedPeers.keys());
    
    if (isConnected) {
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#10b981'; // green
        
        // Build status text with peer count
        let displayText = statusText || 'Connected';
        if (peerCount > 0) {
            if (state.isHosting) {
                displayText = `Connected (${peerCount} ${peerCount === 1 ? 'user' : 'users'})`;
            } else {
                displayText = 'Connected to host';
            }
        }
        textEl.textContent = displayText;
        
        // Add tooltip with peer list if there are peers
        if (peerCount > 0 && state.isHosting) {
            const peerListText = peerList.map(id => id.substring(0, 8)).join(', ');
            textEl.title = `Connected peers: ${peerListText}`;
        } else {
            textEl.title = '';
        }
        
        if (shareCode) {
            codeEl.textContent = shareCode;
            codeEl.classList.remove('hidden');
            if (copyBtn) {
                copyBtn.classList.remove('hidden');
                // Set up copy button event listener
                copyBtn.onclick = () => handleCopyCode(shareCode);
            }
        } else {
            if (copyBtn) copyBtn.classList.add('hidden');
        }
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
        btnEl.style.backgroundColor = 'var(--status-error)';
        btnEl.style.color = 'white';
    } else if (shareCode) {
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#f59e0b'; // yellow
        textEl.textContent = statusText || (state.isHosting ? 'Waiting for peers...' : 'Waiting for peer...');
        textEl.title = '';
        codeEl.textContent = shareCode;
        codeEl.classList.remove('hidden');
        if (copyBtn) {
            copyBtn.classList.remove('hidden');
            // Set up copy button event listener
            copyBtn.onclick = () => handleCopyCode(shareCode);
        }
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
    } else if (statusText) {
        // Show status even without share code (e.g., "Connecting...")
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#3b82f6'; // blue for connecting
        textEl.textContent = statusText;
        textEl.title = '';
        codeEl.classList.add('hidden');
        if (copyBtn) copyBtn.classList.add('hidden');
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
    } else {
        statusEl.classList.add('hidden');
        codeEl.classList.add('hidden');
        if (copyBtn) copyBtn.classList.add('hidden');
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Collaborate</span>';
        btnEl.style.backgroundColor = 'var(--button-secondary-bg)';
        btnEl.style.color = 'var(--text-primary)';
    }
    if (window.lucide) lucide.createIcons();
}

