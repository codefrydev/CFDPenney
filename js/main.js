// Main Entry Point
import { app } from './theme.js';
import { initUI, updateUI } from './ui.js';
import { closeCollaborationModal, handleHostSession, handleJoinSession } from './modal.js';
import { getCodeFromURL, joinCollaborationWithCode } from './collaboration.js';
import { state } from './state.js';

// Initialize app
function init() {
    initUI();
    if (window.lucide) {
        lucide.createIcons();
    }
    app.initTheme();
    
    // Check for code in URL and auto-join if valid
    const urlCode = getCodeFromURL();
    if (urlCode && urlCode.length === 5) {
        // Wait a bit for UI to be fully initialized, then auto-join
        setTimeout(() => {
            // Only auto-join if not already collaborating
            if (!state.isCollaborating) {
                // Auto-fill the join input for visual feedback
                const joinInput = document.getElementById('join-code-input');
                if (joinInput) {
                    joinInput.value = urlCode;
                }
                // Automatically join the session
                joinCollaborationWithCode(urlCode);
            }
        }, 500);
    }
}

// Make app available globally for inline event handlers
window.app = app;

// Make modal functions globally available
window.closeCollaborationModal = closeCollaborationModal;
window.handleHostSession = handleHostSession;
window.handleJoinSession = handleJoinSession;

// Start App
init();

