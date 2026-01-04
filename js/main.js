// Main Entry Point
import { app } from './theme.js';
import { initUI, updateUI } from './ui.js';
import { closeCollaborationModal, handleHostSession, handleJoinSession } from './modal.js';

// Initialize app
function init() {
    initUI();
    if (window.lucide) {
        lucide.createIcons();
    }
    app.initTheme();
}

// Make app available globally for inline event handlers
window.app = app;

// Make modal functions globally available
window.closeCollaborationModal = closeCollaborationModal;
window.handleHostSession = handleHostSession;
window.handleJoinSession = handleJoinSession;

// Start App
init();

