// Desktop Collaboration Wrapper
// Bridges the shared collaboration modules with desktop-specific functionality

import { state } from '../state.js';
import { desktopAdapter } from '../../shared/adapters/desktopAdapter.js';
import { 
    startCollaboration as sharedStartCollaboration,
    joinCollaborationWithCode as sharedJoinCollaboration,
    stopCollaboration as sharedStopCollaboration,
    initPeerJS
} from '../../shared/collaboration/collaborationCore.js';
import { setupCallHandlers as sharedSetupCallHandlers, shareScreenWithPeers as sharedShareScreenWithPeers, shareCameraWithPeers as sharedShareCameraWithPeers, remoteCameraStreams } from '../../shared/collaboration/videoCall.js';
import { sendToAllPeers as sharedSendToAllPeers, sendToPeer as sharedSendToPeer, sendChatMessage as sharedSendChatMessage } from '../../shared/collaboration/messageSender.js';
import { normalizeElement as sharedNormalizeElement, denormalizeElement as sharedDenormalizeElement } from '../../shared/collaboration/coordinateUtils.js';
import { handlePeerMessage } from './messageHandler.js';

// Desktop-specific screen stream handler (no-op for desktop overlay)
function handleRemoteScreenStream(remoteStream, peerId, videoTrack) {
    // Desktop overlay doesn't display remote screen streams
    // Remote streams are handled by the main screen window
}

// Wrapper for setupCallHandlers with desktop-specific screen handler
function setupCallHandlers(call, peerId) {
    sharedSetupCallHandlers(call, peerId, state, handleRemoteScreenStream);
}

// Wrapper for recreateCallWithStream
function recreateCallWithStream(stream, peerId) {
    if (!state.isHosting || !peerId || !state.peer) return;
    
    const existingCall = state.calls.get(peerId);
    if (existingCall) {
        existingCall.close();
        state.calls.delete(peerId);
    }

    const call = state.peer.call(peerId, stream);
    if (call) {
        state.calls.set(peerId, call);
        setupCallHandlers(call, peerId);
    }
}

// Export wrapped functions
export async function startCollaboration() {
    // Initialize PeerJS from CDN
    const Peer = initPeerJS();
    return sharedStartCollaboration(state, desktopAdapter, handlePeerMessage, setupCallHandlers, Peer);
}

export async function joinCollaborationWithCode(code) {
    // Initialize PeerJS from CDN
    const Peer = initPeerJS();
    return sharedJoinCollaboration(code, state, desktopAdapter, handlePeerMessage, setupCallHandlers, stopCollaboration, Peer);
}

export function stopCollaboration() {
    return sharedStopCollaboration(state, desktopAdapter);
}

export function shareScreenWithPeers(stream) {
    return sharedShareScreenWithPeers(stream, state, recreateCallWithStream);
}

export function shareCameraWithPeers(stream) {
    return sharedShareCameraWithPeers(stream, state);
}

// Export message sending functions with state bound
export function sendToAllPeers(stateArg, message) {
    return sharedSendToAllPeers(stateArg || state, message);
}

export function sendToPeer(stateArg, message, peerId = null) {
    return sharedSendToPeer(stateArg || state, message, peerId);
}

export function sendChatMessage(stateArg, message) {
    return sharedSendChatMessage(stateArg || state, message);
}

// Export coordinate utilities with adapter bound
export function normalizeElement(element) {
    return sharedNormalizeElement(element, desktopAdapter);
}

export function denormalizeElement(element) {
    return sharedDenormalizeElement(element, desktopAdapter);
}

// Re-export initPeerJS
export { initPeerJS };

// Make functions available globally
if (typeof window !== 'undefined') {
    window.shareScreenWithPeers = shareScreenWithPeers;
    window.shareCameraWithPeers = shareCameraWithPeers;
    window.remoteCameraStreams = remoteCameraStreams;
}
