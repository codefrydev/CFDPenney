// Video Call Setup and Stream Management
import { state } from '../state.js';
import { updateParticipantCamera } from './participantsPanel.js';

// Store remote camera streams
export const remoteCameraStreams = new Map(); // Map<peerId, {stream, videoElement}>

// Handle remote camera streams - now updates participants panel
function handleRemoteCameraStream(remoteStream, peerId) {
    console.log(`handleRemoteCameraStream: Storing camera stream for peer ${peerId}`, remoteStream);
    
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
            console.log(`Camera stream ended for peer ${peerId}`);
            removeRemoteCamera(peerId);
        };
    }
}

// Remove remote camera stream
function removeRemoteCamera(peerId) {
    console.log(`removeRemoteCamera: Removing camera stream for peer ${peerId}`);
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
        console.log(`Received remote stream from peer ${peerId}`, remoteStream);
        
        // Check if this is a real video stream (not a dummy stream)
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (!videoTrack) {
            console.warn(`No video track in stream from peer ${peerId}`);
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
            console.warn('Could not check if stream is dummy:', e);
        }
        
        if (isDummyStream) {
            console.log(`Dummy stream received from peer ${peerId}, ignoring`);
            // If a dummy stream is received for a camera, it means the camera was stopped
            if (isCameraCall) {
                removeRemoteCamera(peerId);
                if (window.updateParticipantsPanel) window.updateParticipantsPanel();
            }
            return;
        }
        
        // Handle camera streams separately
        if (isCameraCall) {
            console.log(`Received camera stream from peer ${peerId}`);
            handleRemoteCameraStream(remoteStream, peerId);
            if (window.updateParticipantsPanel) window.updateParticipantsPanel();
            return;
        }
        
        // Handle screen share streams
        // If host is sharing their own screen, don't overwrite it with remote streams
        // Host should always see their own screen share
        if (state.isHosting && state.stream && state.mode === 'screen') {
            console.log(`Host is sharing their own screen, ignoring remote stream from peer ${peerId}`);
            return;
        }
        
        // Display the remote stream in the video element
        const videoElem = document.getElementById('screen-video');
        const videoPlaceholder = document.getElementById('screen-placeholder');
        const videoControls = document.getElementById('screen-controls');
        const bgScreen = document.getElementById('bg-screen');
        
        if (videoElem && remoteStream) {
            console.log(`Displaying remote screen share from peer ${peerId} in video element`);
            
            // Set the remote stream to the video element
            videoElem.srcObject = remoteStream;
            
            // Ensure video plays - handle AbortError gracefully (happens when stream changes quickly)
            videoElem.play().catch(err => {
                // AbortError is expected when a new stream replaces the old one quickly
                // Only log if it's not an AbortError
                if (err.name !== 'AbortError') {
                    console.warn('Error playing remote stream:', err);
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
                console.log(`Remote stream from peer ${peerId} ended`);
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
        console.log(`Call closed for peer ${peerId}`);
        
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
    if (!state.isHosting || !peerId || !state.peer) return;
    
    // Close existing call for this peer
    const existingCall = state.calls.get(peerId);
    if (existingCall) {
        existingCall.close();
        state.calls.delete(peerId);
    }

    // Create new call with screen stream
    const call = state.peer.call(peerId, stream);
    if (call) {
        state.calls.set(peerId, call);
        setupCallHandlers(call, peerId);
    }
}

// Export function for screen sharing integration
export function shareScreenWithPeers(stream) {
    if (!state.isCollaborating || !stream) {
        console.warn('shareScreenWithPeers: Not collaborating or no stream');
        return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
        console.warn('shareScreenWithPeers: No video track in stream');
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
            console.log(`Successfully replaced track for peer ${peerId}`);
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
                console.warn(`shareScreenWithPeers: Connection to ${peerId} not open`);
                return;
            }

            const existingCall = state.calls.get(peerId);
            
            if (existingCall && existingCall.peerConnection) {
                // Check if peer connection is in a ready state
                if (!isPeerConnectionReady(existingCall.peerConnection)) {
                    console.warn(`shareScreenWithPeers: Peer connection to ${peerId} not ready, will retry`);
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
                    console.log(`shareScreenWithPeers: No video sender found for ${peerId}, recreating call`);
                    recreateCallWithStream(stream, peerId);
                }
            } else {
                // No call exists, create new one
                if (state.peer) {
                    console.log(`shareScreenWithPeers: Creating new call to ${peerId}`);
                    try {
                        const call = state.peer.call(peerId, stream);
                        if (call) {
                            state.calls.set(peerId, call);
                            setupCallHandlers(call, peerId);
                        }
                    } catch (err) {
                        console.error(`Error creating call to ${peerId}:`, err);
                    }
                } else {
                    console.warn(`shareScreenWithPeers: No peer instance available for ${peerId}`);
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
                    console.warn('shareScreenWithPeers: Peer connection to host not ready, will retry');
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
                        if (state.peer && hostPeerId) {
                            const existingCall = state.calls.get(hostPeerId);
                            if (existingCall) {
                                existingCall.close();
                                state.calls.delete(hostPeerId);
                            }
                            const call = state.peer.call(hostPeerId, stream);
                            if (call) {
                                state.calls.set(hostPeerId, call);
                                setupCallHandlers(call, hostPeerId);
                            }
                        }
                    });
                } else {
                    // No video sender, recreate call
                    console.log('shareScreenWithPeers: No video sender found as joiner, recreating call');
                    const existingCall = state.calls.get(hostPeerId);
                    if (existingCall) {
                        existingCall.close();
                        state.calls.delete(hostPeerId);
                    }
                    if (state.peer) {
                        const call = state.peer.call(hostPeerId, stream);
                        if (call) {
                            state.calls.set(hostPeerId, call);
                            setupCallHandlers(call, hostPeerId);
                        }
                    }
                }
            } else if (state.peer && !existingCall) {
                // Create new call to host
                console.log('shareScreenWithPeers: Creating new call to host as joiner');
                try {
                    const call = state.peer.call(hostPeerId, stream);
                    if (call) {
                        state.calls.set(hostPeerId, call);
                        setupCallHandlers(call, hostPeerId);
                    }
                } catch (err) {
                    console.error('Error creating call to host as joiner:', err);
                }
            }
        } else {
            console.warn('shareScreenWithPeers: No open connection to host');
        }
    }
}

// Make shareScreenWithPeers available globally for screenShare module
window.shareScreenWithPeers = shareScreenWithPeers;

// Camera stream sharing function - uses separate calls from screen share
export function shareCameraWithPeers(stream) {
    if (!state.isCollaborating) {
        console.warn('shareCameraWithPeers: Not collaborating');
        return;
    }

    // If stream is null, camera was stopped - close all camera calls
    if (!stream) {
        console.log('shareCameraWithPeers: Camera stopped, closing camera calls');
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
        console.warn('shareCameraWithPeers: No video track in camera stream');
        return;
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
                console.warn(`shareCameraWithPeers: Connection to ${peerId} not open`);
                return;
            }

            const existingCameraCall = state.cameraCalls.get(peerId);
            
            if (existingCameraCall && existingCameraCall.peerConnection) {
                if (!isPeerConnectionReady(existingCameraCall.peerConnection)) {
                    console.warn(`shareCameraWithPeers: Camera peer connection to ${peerId} not ready, will retry`);
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
                        audioSender.replaceTrack(audioTrack).catch(err => {
                            console.error(`Error replacing camera audio track for peer ${peerId}:`, err);
                        });
                    } else {
                        existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                    }
                }
            } else {
                // Create new camera call
                if (state.peer) {
                    console.log(`shareCameraWithPeers: Creating new camera call to ${peerId}`);
                    try {
                        const call = state.peer.call(peerId, stream, { metadata: { isCameraCall: true } });
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
                                        console.log(`shareCameraWithPeers: Camera call to ${peerId} established`);
                                    } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                                        console.warn(`shareCameraWithPeers: Camera call to ${peerId} failed, will retry`);
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
                    console.warn('shareCameraWithPeers: Camera peer connection to host not ready, will retry');
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
                        audioSender.replaceTrack(audioTrack).catch(err => {
                            console.error(`Error replacing camera audio track for host:`, err);
                        });
                    } else {
                        existingCameraCall.peerConnection.addTrack(audioTrack, stream);
                    }
                }
            } else if (state.peer && !existingCameraCall) {
                // Create new camera call to host
                console.log('shareCameraWithPeers: Creating new camera call to host as joiner');
                try {
                    const call = state.peer.call(hostPeerId, stream, { metadata: { isCameraCall: true } });
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
                                    console.log('shareCameraWithPeers: Camera call to host established');
                                } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                                    console.warn('shareCameraWithPeers: Camera call to host failed, will retry');
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

// Make shareCameraWithPeers available globally for camera module
window.shareCameraWithPeers = shareCameraWithPeers;

// Make remoteCameraStreams available globally for participants panel
window.remoteCameraStreams = remoteCameraStreams;

