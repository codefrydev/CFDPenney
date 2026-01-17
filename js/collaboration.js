// Public API Entry Point - Re-exports all collaboration functions
// This maintains backward compatibility with existing imports

// Re-export URL utils and connection status (still web-specific)
export { getCodeFromURL } from './collaboration/urlUtils.js';
export { updateConnectionStatus } from './collaboration/connectionStatus.js';

// Re-export shared message sender functions
import { state } from './state.js';
import { sendToAllPeers as sharedSendToAllPeers, sendToPeer as sharedSendToPeer } from '../shared/collaboration/messageSender.js';

export function sendToAllPeers(message) {
    return sharedSendToAllPeers(state, message);
}

export function sendToPeer(message, peerId = null) {
    return sharedSendToPeer(state, message, peerId);
}

// Import lifecycle functions from wrapper
import { 
    startCollaboration as _startCollaboration, 
    joinCollaborationWithCode, 
    stopCollaboration,
    shareScreenWithPeers
} from './collaboration/collaborationWrapper.js';

// Wrap startCollaboration to handle the stop case
export async function startCollaboration() {
    if (state.isCollaborating) {
        stopCollaboration();
        return;
    }
    return _startCollaboration();
}

export { joinCollaborationWithCode, stopCollaboration, shareScreenWithPeers };
