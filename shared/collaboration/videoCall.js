// Video Call Setup and Stream Management
// Shared module for handling WebRTC video/audio calls

// Store remote camera streams
export const remoteCameraStreams = new Map(); // Map<peerId, {stream}>

/**
 * Handle remote camera stream
 * @param {MediaStream} remoteStream - The remote camera stream
 * @param {string} peerId - The peer ID
 */
function handleRemoteCameraStream(remoteStream, peerId) {
    // Store stream reference
    remoteCameraStreams.set(peerId, {
        stream: remoteStream
    });
    
    // Update participants panel
    if (typeof window !== 'undefined') {
        if (window.updateParticipantCamera) {
            window.updateParticipantCamera(peerId, remoteStream);
        }
        if (window.updateParticipantsPanel) {
            window.updateParticipantsPanel();
        }
    }
    
    // Handle stream end
    const videoTrack = remoteStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.onended = () => {
            removeRemoteCamera(peerId);
        };
    }
}

/**
 * Remove remote camera stream
 * @param {string} peerId - The peer ID
 */
function removeRemoteCamera(peerId) {
    remoteCameraStreams.delete(peerId);
    
    // Update participants panel
    if (typeof window !== 'undefined') {
        if (window.updateParticipantCamera) {
            window.updateParticipantCamera(peerId, null);
        }
        if (window.updateParticipantsPanel) {
            window.updateParticipantsPanel();
        }
    }
}

/**
 * Check if a stream is a dummy stream (1x1 canvas)
 * @param {MediaStreamTrack} videoTrack - The video track to check
 * @returns {boolean} Whether the stream is a dummy stream
 */
function isDummyStream(videoTrack) {
    if (!videoTrack) return true;
    
    try {
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : null;
        const constraints = videoTrack.getConstraints ? videoTrack.getConstraints() : null;
        
        // Check dimensions - dummy streams are typically 1x1
        if (settings && settings.width === 1 && settings.height === 1) {
            return true;
        } else if (constraints && constraints.width === 1 && constraints.height === 1) {
            return true;
        }
        
        // Also check track label - dummy streams often have specific labels
        if (videoTrack.label && (videoTrack.label.includes('canvas') || videoTrack.label.includes('dummy'))) {
            return true;
        }
    } catch (e) {
        // If we can't check, assume it's a real stream
    }
    
    return false;
}

/**
 * Setup call handlers for a WebRTC call
 * @param {Object} call - The PeerJS media call
 * @param {string} peerId - The peer ID
 * @param {Object} state - The application state
 * @param {Function} handleRemoteScreenStream - Platform-specific handler for screen streams (optional)
 */
export function setupCallHandlers(call, peerId, state, handleRemoteScreenStream = null) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
        // Check if this is a real video stream (not a dummy stream)
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (!videoTrack) {
            return;
        }
        
        // Check if this is a camera call (using call metadata)
        const isCameraCall = call._isCameraCall || (call.metadata && call.metadata.isCameraCall);
        
        // Check if it's a dummy stream
        if (isDummyStream(videoTrack)) {
            // If a dummy stream is received for a camera, it means the camera was stopped
            if (isCameraCall) {
                removeRemoteCamera(peerId);
                if (typeof window !== 'undefined' && window.updateParticipantsPanel) {
                    window.updateParticipantsPanel();
                }
            }
            return;
        }
        
        // Handle camera streams separately
        if (isCameraCall) {
            handleRemoteCameraStream(remoteStream, peerId);
            if (typeof window !== 'undefined' && window.updateParticipantsPanel) {
                window.updateParticipantsPanel();
            }
            return;
        }
        
        // Handle screen share streams
        // If host is sharing their own screen, don't overwrite it with remote streams
        if (state.isHosting && state.stream && state.mode === 'screen') {
            return;
        }
        
        // Call platform-specific handler for screen streams
        if (handleRemoteScreenStream) {
            handleRemoteScreenStream(remoteStream, peerId, videoTrack);
        }
    });

    call.on('close', () => {
        // Check if this is a camera call or screen share call
        const isCameraCall = call._isCameraCall || state.cameraCalls.has(peerId);
        
        if (isCameraCall) {
            state.cameraCalls.delete(peerId);
            removeRemoteCamera(peerId);
        } else {
            if (peerId && state.calls.has(peerId)) {
                state.calls.delete(peerId);
            }
        }
    });

    call.on('error', (err) => {
        console.error(`Call error for peer ${peerId}:`, err);
    });
}

/**
 * Check if peer connection is ready
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @returns {boolean} Whether the connection is ready
 */
function isPeerConnectionReady(peerConnection) {
    if (!peerConnection) return false;
    const connectionState = peerConnection.connectionState || peerConnection.iceConnectionState;
    return connectionState === 'connected' || connectionState === 'completed' || connectionState === 'checking';
}

/**
 * Replace track safely with fallback
 * @param {RTCRtpSender} sender - The RTP sender
 * @param {MediaStreamTrack} track - The new track
 * @param {string} peerId - The peer ID
 * @param {Function} fallbackFn - Fallback function if replace fails
 */
async function replaceTrackSafely(sender, track, peerId, fallbackFn) {
    try {
        if (!sender || !track) {
            throw new Error('Invalid sender or track');
        }
        await sender.replaceTrack(track);
    } catch (err) {
        console.error(`Error replacing track for peer ${peerId}:`, err);
        if (fallbackFn) {
            setTimeout(() => fallbackFn(), 100);
        }
    }
}

/**
 * Share screen with connected peers
 * @param {MediaStream} stream - The screen stream to share
 * @param {Object} state - The application state
 * @param {Function} recreateCallFn - Function to recreate call with new stream
 */
export function shareScreenWithPeers(stream, state, recreateCallFn) {
    if (!state.isCollaborating || !stream) {
        return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
        return;
    }

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
                    setTimeout(() => {
                        if (state.calls.has(peerId) && state.mode === 'screen' && state.stream) {
                            shareScreenWithPeers(state.stream, state, recreateCallFn);
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
                        if (recreateCallFn) {
                            recreateCallFn(stream, peerId);
                        }
                    });
                } else {
                    // No video sender found, recreate call
                    if (recreateCallFn) {
                        recreateCallFn(stream, peerId);
                    }
                }
            } else {
                // No call exists, create new one
                if (state.peer) {
                    try {
                        const call = state.peer.call(peerId, stream);
                        if (call) {
                            state.calls.set(peerId, call);
                            setupCallHandlers(call, peerId, state);
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
        const hostPeerId = Array.from(state.dataConnections.keys())[0];
        if (hostPeerId && state.dataConnections.get(hostPeerId)?.open) {
            const existingCall = state.calls.get(hostPeerId);
            
            if (existingCall && existingCall.peerConnection) {
                if (!isPeerConnectionReady(existingCall.peerConnection)) {
                    setTimeout(() => {
                        if (state.calls.has(hostPeerId) && state.mode === 'screen' && state.stream) {
                            shareScreenWithPeers(state.stream, state, recreateCallFn);
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
                        if (recreateCallFn) {
                            recreateCallFn(stream, hostPeerId);
                        }
                    });
                } else {
                    if (recreateCallFn) {
                        recreateCallFn(stream, hostPeerId);
                    }
                }
            } else if (state.peer && !existingCall) {
                // Create new call to host
                try {
                    const call = state.peer.call(hostPeerId, stream);
                    if (call) {
                        state.calls.set(hostPeerId, call);
                        setupCallHandlers(call, peerId, state);
                    }
                } catch (err) {
                    console.error('Error creating call to host as joiner:', err);
                }
            }
        }
    }
}

/**
 * Share camera with connected peers
 * @param {MediaStream} stream - The camera stream to share (null to stop sharing)
 * @param {Object} state - The application state
 */
export function shareCameraWithPeers(stream, state) {
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
                            shareCameraWithPeers(state.cameraStream, state);
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
                        audioSender.replaceTrack(audioTrack).catch(err => {
                            console.error(`Error replacing camera audio track for peer ${peerId}:`, err);
                        });
                    } else {
                        try {
                            existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                        } catch (err) {
                            console.error(`Error adding audio track for peer ${peerId}:`, err);
                        }
                    }
                }
            } else {
                // Create new camera call
                if (state.peer) {
                    try {
                        const call = state.peer.call(peerId, stream, { metadata: { isCameraCall: true } });
                        if (call) {
                            state.cameraCalls.set(peerId, call);
                            call._isCameraCall = true;
                            setupCallHandlers(call, peerId, state);
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
                            shareCameraWithPeers(state.cameraStream, state);
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
                        audioSender.replaceTrack(audioTrack).catch(err => {
                            console.error(`Error replacing camera audio track for host:`, err);
                        });
                    } else {
                        try {
                            existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                        } catch (err) {
                            console.error(`Error adding audio track for host:`, err);
                        }
                    }
                }
            } else if (state.peer && !existingCameraCall) {
                // Create new camera call to host
                try {
                    const call = state.peer.call(hostPeerId, stream, { metadata: { isCameraCall: true } });
                    if (call) {
                        state.cameraCalls.set(hostPeerId, call);
                        call._isCameraCall = true;
                        setupCallHandlers(call, hostPeerId, state);
                    }
                } catch (err) {
                    console.error('Error creating camera call to host as joiner:', err);
                }
            }
        }
    }
}
