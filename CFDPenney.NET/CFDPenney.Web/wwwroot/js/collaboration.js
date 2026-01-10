// Public API Entry Point - Re-exports all collaboration functions
// This maintains backward compatibility with existing imports

// Re-export all public functions from modules
export { getCodeFromURL } from './collaboration/urlUtils.js';
export { updateConnectionStatus } from './collaboration/connectionStatus.js';
export { sendToAllPeers, sendToPeer } from './collaboration/messageSender.js';
export { shareScreenWithPeers } from './collaboration/videoCall.js';

// Import lifecycle functions
import { startCollaboration as _startCollaboration, joinCollaborationWithCode, stopCollaboration } from './collaboration/collaborationCore.js';

// Wrap startCollaboration to handle the stop case
import { state } from './state.js';

export async function startCollaboration() {
    if (state.isCollaborating) {
        stopCollaboration();
        return;
    }
    return _startCollaboration();
}

export { joinCollaborationWithCode, stopCollaboration };
