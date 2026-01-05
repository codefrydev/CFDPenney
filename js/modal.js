// Collaboration Modal Management
import { startCollaboration, joinCollaborationWithCode } from './collaboration.js';
import { showAlert } from './popupModal.js';

export function showCollaborationModal() {
    const modal = document.getElementById('collaboration-modal-overlay');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset join code input
        const joinInput = document.getElementById('join-code-input');
        if (joinInput) {
            joinInput.value = '';
            joinInput.focus();
        }
        if (window.lucide) lucide.createIcons();
    }
}

export function closeCollaborationModal(event) {
    // Only close if clicking overlay or close button
    if (event && event.target.id !== 'collaboration-modal-overlay' && event.target.id !== 'close-collaboration-modal' && !event.target.closest('#close-collaboration-modal')) {
        return;
    }
    const modal = document.getElementById('collaboration-modal-overlay');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export function handleHostSession() {
    closeCollaborationModal();
    startCollaboration();
}

export function handleJoinSession() {
    const joinInput = document.getElementById('join-code-input');
    const code = joinInput ? joinInput.value.trim().toUpperCase() : '';
    
    if (!code || code.length !== 5) {
        showAlert('Please enter a valid 5-character code');
        if (joinInput) joinInput.focus();
        return;
    }
    
    closeCollaborationModal();
    joinCollaborationWithCode(code);
}

