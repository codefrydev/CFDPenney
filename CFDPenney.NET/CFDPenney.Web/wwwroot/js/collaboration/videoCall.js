// Video Call Setup and Stream Management
// Note: Video/audio still uses PeerJS/WebRTC for peer-to-peer media streaming
// SignalR is used for data (drawing, chat) but WebRTC is used for video/audio
import { state } from '../state.js';
import { updateParticipantCamera } from './participantsPanel.js';

// Initialize PeerJS instance for video calls (separate from SignalR data connection)
let videoPeer = null;

export function initializeVideoPeer() {
    if (videoPeer || typeof Peer === 'undefined') {
        return videoPeer;
    }
    
    // Create a PeerJS instance for video/audio only
    // Use a random ID since SignalR handles session management
    videoPeer = new Peer({
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { 
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                { 
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10
        }
    });
    
    videoPeer.on('open', (id) => {
        console.log('[VideoPeer] Initialized with ID:', id);
        state.peer = videoPeer; // Set for backward compatibility
    });
    
    videoPeer.on('error', (err) => {
        console.error('[VideoPeer] Error:', err);
    });
    
    // Handle incoming calls for screen sharing
    videoPeer.on('call', (incomingCall) => {
        const peerId = incomingCall.peer;
        const isCameraCall = incomingCall.metadata && incomingCall.metadata.isCameraCall;
        
        if (isCameraCall) {
            // Handle camera call
            if (state.cameraCalls.has(peerId)) {
                incomingCall.close();
                return;
            }
            
            state.cameraCalls.set(peerId, incomingCall);
            incomingCall._isCameraCall = true;
            setupCallHandlers(incomingCall, peerId);
            
            // Answer with camera stream if available
            let streamToAnswer = null;
            if (state.isCameraActive && state.cameraStream) {
                streamToAnswer = state.cameraStream;
            } else {
                // Create dummy stream
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
            }
            
            if (streamToAnswer) {
                incomingCall.answer(streamToAnswer);
            } else {
                try {
                    incomingCall.answer();
                } catch (e) {
                    console.error('Error answering camera call:', e);
                }
            }
        } else {
            // Handle screen share call
            if (state.calls.has(peerId)) {
                incomingCall.close();
                return;
            }
            
            state.calls.set(peerId, incomingCall);
            setupCallHandlers(incomingCall, peerId);
            
            // Answer with screen stream if available
            let streamToAnswer = null;
            if (state.mode === 'screen' && state.stream) {
                streamToAnswer = state.stream;
            } else {
                // Create dummy stream
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
            }
            
            if (streamToAnswer) {
                incomingCall.answer(streamToAnswer);
            } else {
                try {
                    incomingCall.answer();
                } catch (e) {
                    console.error('Error answering call:', e);
                }
            }
        }
    });
    
    return videoPeer;
}

// Get or initialize video peer
function getVideoPeer() {
    if (!videoPeer) {
        initializeVideoPeer();
    }
    return videoPeer;
}

// Store remote camera streams
export const remoteCameraStreams = new Map(); // Map<peerId, {stream, videoElement}>

// Handle remote camera streams - now updates participants panel
function handleRemoteCameraStream(remoteStream, peerId) {
    
    // Log audio track information for debugging
    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length > 0) {
        audioTracks.forEach((track, index) => {
        });
    }
    
    // Store stream reference
    remoteCameraStreams.set(peerId, {
        stream: remoteStream
    });
    
    // Update participants panel - both direct update and full refresh
    if (window.updateParticipantCamera) {
        window.updateParticipantCamera(peerId, remoteStream);
    }
    if (window.updateParticipantsPanel) {
        window.updateParticipantsPanel();
    }
    
    // Handle stream end
    const videoTrack = remoteStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.onended = () => {
            removeRemoteCamera(peerId);
        };
    }
}

// Remove remote camera stream
function removeRemoteCamera(peerId) {
    remoteCameraStreams.delete(peerId);
    
    // Update participants panel
    if (window.updateParticipantCamera) {
        window.updateParticipantCamera(peerId, null);
    }
    if (window.updateParticipantsPanel) {
        window.updateParticipantsPanel();
    }
}

export function setupCallHandlers(call, peerId) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
        
        // Log audio track information for debugging
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks.forEach((track, index) => {
            });
        } else {
        }
        
        // Check if this is a real video stream (not a dummy stream)
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (!videoTrack) {
            return;
        }
        
        // Check if this is a camera call (using call metadata)
        const isCameraCall = call._isCameraCall || (call.metadata && call.metadata.isCameraCall);
        
        // Check if it's a dummy stream (1x1 canvas stream)
        // Dummy streams are used as placeholders when screen sharing is not active
        let isDummyStream = false;
        try {
            const settings = videoTrack.getSettings ? videoTrack.getSettings() : null;
            const constraints = videoTrack.getConstraints ? videoTrack.getConstraints() : null;
            
            // Check dimensions - dummy streams are typically 1x1
            if (settings && settings.width === 1 && settings.height === 1) {
                isDummyStream = true;
            } else if (constraints && constraints.width === 1 && constraints.height === 1) {
                isDummyStream = true;
            }
            
            // Also check track label - dummy streams often have specific labels
            if (videoTrack.label && (videoTrack.label.includes('canvas') || videoTrack.label.includes('dummy'))) {
                isDummyStream = true;
            }
        } catch (e) {
            // If we can't check, assume it's a real stream
        }
        
        if (isDummyStream) {
            // If a dummy stream is received for a camera, it means the camera was stopped
            if (isCameraCall) {
                removeRemoteCamera(peerId);
                if (window.updateParticipantsPanel) window.updateParticipantsPanel();
            }
            return;
        }
        
        // Handle camera streams separately
        if (isCameraCall) {
            handleRemoteCameraStream(remoteStream, peerId);
            if (window.updateParticipantsPanel) window.updateParticipantsPanel();
            return;
        }
        
        // Handle screen share streams
        // If host is sharing their own screen, don't overwrite it with remote streams
        // Host should always see their own screen share
        if (state.isHosting && state.stream && state.mode === 'screen') {
            return;
        }
        
        // Display the remote stream in the video element
        const videoElem = document.getElementById('screen-video');
        const videoPlaceholder = document.getElementById('screen-placeholder');
        const videoControls = document.getElementById('screen-controls');
        const bgScreen = document.getElementById('bg-screen');
        
        if (videoElem && remoteStream) {
            
            // Set the remote stream to the video element
            videoElem.srcObject = remoteStream;
            // Explicitly enable audio so users can hear remote person
            videoElem.muted = false;
            
            // Ensure video plays - handle AbortError gracefully (happens when stream changes quickly)
            videoElem.play().catch(err => {
                // AbortError is expected when a new stream replaces the old one quickly
                // Only log if it's not an AbortError
                if (err.name !== 'AbortError') {
                }
            });
            
            // Hide placeholder and show video
            if (videoPlaceholder) {
                videoPlaceholder.classList.add('hidden');
            }
            
            // Show controls (but hide stop button for remote streams)
            if (videoControls) {
                videoControls.classList.remove('hidden');
                // Hide stop button for remote streams (peers can't stop host's share)
                const stopBtn = document.getElementById('btn-stop-share');
                if (stopBtn && !state.isHosting) {
                    stopBtn.style.display = 'none';
                } else if (stopBtn && state.isHosting) {
                    stopBtn.style.display = '';
                }
            }
            
            // Switch to screen mode if not already
            if (state.mode !== 'screen') {
                // Import setMode dynamically to avoid circular dependency
                import('../screenShare.js').then(module => {
                    module.setMode('screen');
                    // Update UI if available
                    if (window.updateUI) {
                        window.updateUI();
                    }
                });
            }
            
            // Show the screen background layer
            if (bgScreen) {
                bgScreen.classList.remove('hidden');
            }
            
            // Update UI to reflect screen mode
            if (window.updateUI) {
                window.updateUI();
            }
            
            // Track when the remote stream ends
            videoTrack.onended = () => {
                // Clear the video element
                if (videoElem) {
                    videoElem.srcObject = null;
                }
                // Show placeholder again
                if (videoPlaceholder) {
                    videoPlaceholder.classList.remove('hidden');
                }
                // Hide controls
                if (videoControls) {
                    videoControls.classList.add('hidden');
                }
                // Switch back to whiteboard mode if we're not sharing our own screen
                if (!state.stream || state.mode === 'screen') {
                    import('../screenShare.js').then(module => {
                        if (!state.stream) {
                            module.setMode('whiteboard');
                            if (window.updateUI) {
                                window.updateUI();
                            }
                        }
                    });
                }
            };
        } else {
            console.error('Video element not found or no remote stream');
        }
    });

    call.on('close', () => {
        
        // Check if this is a camera call or screen share call
        const isCameraCall = call._isCameraCall || state.cameraCalls.has(peerId);
        
        if (isCameraCall) {
            state.cameraCalls.delete(peerId);
            // Remove remote camera for this peer
            removeRemoteCamera(peerId);
        } else {
            if (peerId && state.calls.has(peerId)) {
                state.calls.delete(peerId);
            }
            
            // If this was the only call and we're viewing a remote stream, clear it
            if (state.calls.size === 0) {
                const videoElem = document.getElementById('screen-video');
                const videoPlaceholder = document.getElementById('screen-placeholder');
                const videoControls = document.getElementById('screen-controls');
                
                // Only clear if we don't have our own stream
                if (!state.stream && videoElem) {
                    videoElem.srcObject = null;
                    if (videoPlaceholder) {
                        videoPlaceholder.classList.remove('hidden');
                    }
                    if (videoControls) {
                        videoControls.classList.add('hidden');
                    }
                }
            }
        }
    });

    call.on('error', (err) => {
        console.error(`Call error for peer ${peerId}:`, err);
    });
}

export function recreateCallWithStream(stream, peerId) {
    if (!state.isHosting || !peerId) return;
    
    const peer = getVideoPeer();
    if (!peer) {
        console.warn('[VideoCall] Video peer not initialized');
        return;
    }
    
    // Close existing call for this peer
    const existingCall = state.calls.get(peerId);
    if (existingCall) {
        existingCall.close();
        state.calls.delete(peerId);
    }

    // Create new call with screen stream
    const call = peer.call(peerId, stream);
    if (call) {
        state.calls.set(peerId, call);
        setupCallHandlers(call, peerId);
    }
}

// Export function for screen sharing integration
export function shareScreenWithPeers(stream) {
    if (!state.isCollaborating || !stream) {
        return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
        return;
    }

    // Helper function to check if peer connection is ready
    const isPeerConnectionReady = (peerConnection) => {
        if (!peerConnection) return false;
        const connectionState = peerConnection.connectionState || peerConnection.iceConnectionState;
        return connectionState === 'connected' || connectionState === 'completed' || connectionState === 'checking';
    };

    // Helper function to replace track with better error handling
    const replaceTrackSafely = async (videoSender, track, peerId, fallbackFn) => {
        try {
            if (!videoSender || !track) {
                throw new Error('Invalid sender or track');
            }
            await videoSender.replaceTrack(track);
        } catch (err) {
            console.error(`Error replacing track for peer ${peerId}:`, err);
            // If replace fails, use fallback (recreate call)
            if (fallbackFn) {
                setTimeout(() => fallbackFn(), 100);
            }
        }
    };

    // If we're the host, broadcast to all connected peers
    if (state.isHosting) {
        state.dataConnections.forEach((conn, peerId) => {
            if (!conn || !conn.open) {
                return;
            }

            const existingCall = state.calls.get(peerId);
            
            if (existingCall && existingCall.peerConnection) {
                // Check if peer connection is in a ready state
                if (!isPeerConnectionReady(existingCall.peerConnection)) {
                    // Wait a bit and retry
                    setTimeout(() => {
                        if (state.calls.has(peerId) && state.mode === 'screen' && state.stream) {
                            shareScreenWithPeers(state.stream);
                        }
                    }, 500);
                    return;
                }

                // Update existing call
                const senders = existingCall.peerConnection.getSenders();
                const videoSender = senders.find(s => 
                    s.track && s.track.kind === 'video'
                );
                
                if (videoSender) {
                    replaceTrackSafely(videoSender, videoTrack, peerId, () => {
                        recreateCallWithStream(stream, peerId);
                    });
                } else {
                    // No video sender found, recreate call
                    recreateCallWithStream(stream, peerId);
                }
            } else {
                // No call exists, create new one
                const peer = getVideoPeer();
                if (peer) {
                    try {
                        const call = peer.call(peerId, stream);
                        if (call) {
                            state.calls.set(peerId, call);
                            setupCallHandlers(call, peerId);
                        }
                    } catch (err) {
                        console.error(`Error creating call to ${peerId}:`, err);
                    }
                }
            }
        });
    } 
    // If we're a joiner, send our stream to the host
    else {
        // Joiners only have one connection (to the host)
        const hostPeerId = Array.from(state.dataConnections.keys())[0];
        if (hostPeerId && state.dataConnections.get(hostPeerId)?.open) {
            const existingCall = state.calls.get(hostPeerId);
            
            if (existingCall && existingCall.peerConnection) {
                // Check if peer connection is in a ready state
                if (!isPeerConnectionReady(existingCall.peerConnection)) {
                    setTimeout(() => {
                        if (state.calls.has(hostPeerId) && state.mode === 'screen' && state.stream) {
                            shareScreenWithPeers(state.stream);
                        }
                    }, 500);
                    return;
                }

                // Update existing call
                const senders = existingCall.peerConnection.getSenders();
                const videoSender = senders.find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (videoSender) {
                    replaceTrackSafely(videoSender, videoTrack, hostPeerId, () => {
                        // Recreate call as joiner
                        const peer = getVideoPeer();
                        if (peer && hostPeerId) {
                            const existingCall = state.calls.get(hostPeerId);
                            if (existingCall) {
                                existingCall.close();
                                state.calls.delete(hostPeerId);
                            }
                            const call = peer.call(hostPeerId, stream);
                            if (call) {
                                state.calls.set(hostPeerId, call);
                                setupCallHandlers(call, hostPeerId);
                            }
                        }
                    });
                } else {
                    // No video sender, recreate call
                    const existingCall = state.calls.get(hostPeerId);
                    if (existingCall) {
                        existingCall.close();
                        state.calls.delete(hostPeerId);
                    }
                    const peer = getVideoPeer();
                    if (peer) {
                        const call = peer.call(hostPeerId, stream);
                        if (call) {
                            state.calls.set(hostPeerId, call);
                            setupCallHandlers(call, hostPeerId);
                        }
                    }
                }
            } else {
                // No existing call, create new one
                const peer = getVideoPeer();
                if (peer) {
                    // Create new call to host
                    try {
                        const call = peer.call(hostPeerId, stream);
                        if (call) {
                            state.calls.set(hostPeerId, call);
                            setupCallHandlers(call, hostPeerId);
                        }
                    } catch (err) {
                        console.error('Error creating call to host as joiner:', err);
                    }
                }
            }
        }
    }
}

// Make shareScreenWithPeers available globally for screenShare module
window.shareScreenWithPeers = shareScreenWithPeers;

// Camera stream sharing function - uses separate calls from screen share
export function shareCameraWithPeers(stream) {
    if (!state.isCollaborating) {
        return;
    }

    // If stream is null, camera was stopped - close all camera calls
    if (!stream) {
        state.cameraCalls.forEach((call, peerId) => {
            if (call) {
                call.close();
            }
        });
        state.cameraCalls.clear();
        return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (!videoTrack) {
        return;
    }
    
    // Log audio track state for debugging
    if (audioTrack) {
    }

    // Note: We can't modify videoTrack.label as it's read-only
    // Instead, we use call metadata to identify camera calls

    // Helper function to check if peer connection is ready
    const isPeerConnectionReady = (peerConnection) => {
        if (!peerConnection) return false;
        const connectionState = peerConnection.connectionState || peerConnection.iceConnectionState;
        return connectionState === 'connected' || connectionState === 'completed' || connectionState === 'checking';
    };

    // If we're the host, broadcast to all connected peers
    if (state.isHosting) {
        state.dataConnections.forEach((conn, peerId) => {
            if (!conn || !conn.open) {
                return;
            }

            const existingCameraCall = state.cameraCalls.get(peerId);
            
            if (existingCameraCall && existingCameraCall.peerConnection) {
                if (!isPeerConnectionReady(existingCameraCall.peerConnection)) {
                    setTimeout(() => {
                        if (state.cameraCalls.has(peerId) && state.isCameraActive && state.cameraStream) {
                            shareCameraWithPeers(state.cameraStream);
                        }
                    }, 500);
                    return;
                }

                // Update existing camera call tracks
                const senders = existingCameraCall.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');

                if (videoSender) {
                    videoSender.replaceTrack(videoTrack).catch(err => {
                        console.error(`Error replacing camera video track for peer ${peerId}:`, err);
                    });
                } else {
                    existingCameraCall.peerConnection.addTrack(videoTrack, stream);
                }

                if (audioTrack) {
                    if (audioSender) {
                        audioSender.replaceTrack(audioTrack).then(() => {
                        }).catch(err => {
                            console.error(`Error replacing camera audio track for peer ${peerId}:`, err);
                            // If replace fails, try adding the track
                            try {
                                existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                            } catch (addErr) {
                                console.error(`Error adding audio track after replace failure for peer ${peerId}:`, addErr);
                            }
                        });
                    } else {
                        try {
                            existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                        } catch (err) {
                            console.error(`Error adding audio track for peer ${peerId}:`, err);
                            // If addTrack fails, the connection might not be ready - retry later
                            setTimeout(() => {
                                if (state.cameraCalls.has(peerId) && state.isCameraActive && state.cameraStream) {
                                    const retryAudioTrack = state.cameraStream.getAudioTracks()[0];
                                    if (retryAudioTrack && existingCameraCall.peerConnection) {
                                        const retrySenders = existingCameraCall.peerConnection.getSenders();
                                        const retryAudioSender = retrySenders.find(s => s.track && s.track.kind === 'audio');
                                        if (!retryAudioSender) {
                                            try {
                                                existingCameraCall.peerConnection.addTrack(retryAudioTrack, state.cameraStream);
                                            } catch (retryErr) {
                                                console.error(`Error adding audio track on retry for peer ${peerId}:`, retryErr);
                                            }
                                        }
                                    }
                                }
                            }, 1000);
                        }
                    }
                }
            } else {
                // Create new camera call
                const peer = getVideoPeer();
                if (peer) {
                    try {
                        const call = peer.call(peerId, stream, { metadata: { isCameraCall: true } });
                        if (call) {
                            state.cameraCalls.set(peerId, call);
                            // Mark this as a camera call for the handler (backup method)
                            call._isCameraCall = true;
                            setupCallHandlers(call, peerId);
                            
                            // Wait for peer connection to be established
                            const checkConnection = () => {
                                if (call.peerConnection) {
                                    const connectionState = call.peerConnection.connectionState || call.peerConnection.iceConnectionState;
                                    if (connectionState === 'connected' || connectionState === 'completed') {
                                    } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                                        state.cameraCalls.delete(peerId);
                                        setTimeout(() => {
                                            if (state.isCameraActive && state.cameraStream && state.isCollaborating) {
                                                shareCameraWithPeers(state.cameraStream);
                                            }
                                        }, 1000);
                                    } else {
                                        // Still connecting, check again
                                        setTimeout(checkConnection, 200);
                                    }
                                } else {
                                    // Peer connection not created yet, wait a bit
                                    setTimeout(checkConnection, 200);
                                }
                            };
                            setTimeout(checkConnection, 100);
                        }
                    } catch (err) {
                        console.error(`Error creating camera call to ${peerId}:`, err);
                    }
                }
            }
        });
    } 
    // If we're a joiner, send camera to the host
    else {
        const hostPeerId = Array.from(state.dataConnections.keys())[0];
        if (hostPeerId && state.dataConnections.get(hostPeerId)?.open) {
            const existingCameraCall = state.cameraCalls.get(hostPeerId);
            
            if (existingCameraCall && existingCameraCall.peerConnection) {
                if (!isPeerConnectionReady(existingCameraCall.peerConnection)) {
                    setTimeout(() => {
                        if (state.cameraCalls.has(hostPeerId) && state.isCameraActive && state.cameraStream) {
                            shareCameraWithPeers(state.cameraStream);
                        }
                    }, 500);
                    return;
                }

                // Update existing camera call tracks
                const senders = existingCameraCall.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');

                if (videoSender) {
                    videoSender.replaceTrack(videoTrack).catch(err => {
                        console.error(`Error replacing camera video track for host:`, err);
                    });
                } else {
                    existingCameraCall.peerConnection.addTrack(videoTrack, stream);
                }

                if (audioTrack) {
                    if (audioSender) {
                        audioSender.replaceTrack(audioTrack).then(() => {
                        }).catch(err => {
                            console.error(`Error replacing camera audio track for host:`, err);
                            // If replace fails, try adding the track
                            try {
                                existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                            } catch (addErr) {
                                console.error(`Error adding audio track after replace failure for host:`, addErr);
                            }
                        });
                    } else {
                        try {
                            existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                        } catch (err) {
                            console.error(`Error adding audio track for host:`, err);
                            // If addTrack fails, the connection might not be ready - retry later
                            setTimeout(() => {
                                if (state.cameraCalls.has(hostPeerId) && state.isCameraActive && state.cameraStream) {
                                    const retryAudioTrack = state.cameraStream.getAudioTracks()[0];
                                    if (retryAudioTrack && existingCameraCall.peerConnection) {
                                        const retrySenders = existingCameraCall.peerConnection.getSenders();
                                        const retryAudioSender = retrySenders.find(s => s.track && s.track.kind === 'audio');
                                        if (!retryAudioSender) {
                                            try {
                                                existingCameraCall.peerConnection.addTrack(retryAudioTrack, state.cameraStream);
                                            } catch (retryErr) {
                                                console.error(`Error adding audio track on retry for host:`, retryErr);
                                            }
                                        }
                                    }
                                }
                            }, 1000);
                        }
                    }
                }
            } else {
                // Create new camera call to host
                const peer = getVideoPeer();
                if (peer && !existingCameraCall) {
                    try {
                        const call = peer.call(hostPeerId, stream, { metadata: { isCameraCall: true } });
                        if (call) {
                            state.cameraCalls.set(hostPeerId, call);
                            // Mark this as a camera call for the handler (backup method)
                            call._isCameraCall = true;
                            setupCallHandlers(call, hostPeerId);
                            
                            // Wait for peer connection to be established, then retry if needed
                            const checkConnection = () => {
                                if (call.peerConnection) {
                                    const connectionState = call.peerConnection.connectionState || call.peerConnection.iceConnectionState;
                                    if (connectionState === 'connected' || connectionState === 'completed') {
                                        // Connection established
                                    } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                                        state.cameraCalls.delete(hostPeerId);
                                        setTimeout(() => {
                                            if (state.isCameraActive && state.cameraStream && state.isCollaborating) {
                                                shareCameraWithPeers(state.cameraStream);
                                            }
                                        }, 1000);
                                    } else {
                                        // Still connecting, check again
                                        setTimeout(checkConnection, 200);
                                    }
                                } else {
                                    // Peer connection not created yet, wait a bit
                                    setTimeout(checkConnection, 200);
                                }
                            };
                            setTimeout(checkConnection, 100);
                        }
                    } catch (err) {
                        console.error('Error creating camera call to host as joiner:', err);
                    }
                }
            }
        }
    }
}

// Make shareCameraWithPeers available globally for camera module
window.shareCameraWithPeers = shareCameraWithPeers;

// Make remoteCameraStreams available globally for participants panel
window.remoteCameraStreams = remoteCameraStreams;

