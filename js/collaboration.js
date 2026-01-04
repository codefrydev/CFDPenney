// Peer Collaboration
import { state } from './state.js';
import { redrawCanvas } from './canvas.js';

export function updateConnectionStatus(isConnected, shareCode = null, statusText = null) {
    const statusEl = document.getElementById('connection-status');
    const dotEl = document.getElementById('connection-dot');
    const textEl = document.getElementById('connection-text');
    const codeEl = document.getElementById('share-code-display');
    const btnEl = document.getElementById('btn-collaborate');
    
    if (!statusEl || !dotEl || !textEl || !btnEl) return;
    
    if (isConnected) {
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#10b981'; // green
        textEl.textContent = statusText || 'Connected';
        if (shareCode) {
            codeEl.textContent = shareCode;
            codeEl.classList.remove('hidden');
        }
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
        btnEl.style.backgroundColor = 'var(--status-error)';
        btnEl.style.color = 'white';
    } else if (shareCode) {
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#f59e0b'; // yellow
        textEl.textContent = statusText || 'Waiting for peer...';
        codeEl.textContent = shareCode;
        codeEl.classList.remove('hidden');
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
    } else if (statusText) {
        // Show status even without share code (e.g., "Connecting...")
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#3b82f6'; // blue for connecting
        textEl.textContent = statusText;
        codeEl.classList.add('hidden');
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
    } else {
        statusEl.classList.add('hidden');
        codeEl.classList.add('hidden');
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Collaborate</span>';
        btnEl.style.backgroundColor = 'var(--button-secondary-bg)';
        btnEl.style.color = 'var(--text-primary)';
    }
    if (window.lucide) lucide.createIcons();
}

export function sendToPeer(message) {
    if (!state.isCollaborating) {
        return false;
    }
    if (!state.dataConnection) {
        return false;
    }
    if (!state.dataConnection.open) {
        return false;
    }
    try {
        const messageStr = JSON.stringify(message);
        state.dataConnection.send(messageStr);
        return true;
    } catch (err) {
        console.error('sendToPeer: Error sending message:', message.type, err);
        return false;
    }
}

function setupCallHandlers(call) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
        // Handle remote stream - could display it in a separate video element
        // For now, we'll just log it since the main screen share is shown locally
    });

    call.on('close', () => {
        if (state.call === call) {
            state.call = null;
        }
    });

    call.on('error', (err) => {
        console.error('Call error:', err);
    });
}

function handlePeerMessage(message) {
    switch (message.type) {
        case 'ANNOTATION_START':
            // Peer started drawing
            const newPeerElement = {
                id: message.id || `peer-${Date.now()}-${Math.random()}`,
                type: message.tool,
                color: message.color,
                width: message.width,
                points: [{ x: message.x, y: message.y }],
                start: { x: message.x, y: message.y },
                end: { x: message.x, y: message.y },
                isPeer: true,
                isActive: true // Mark as active drawing
            };
            state.peerElements.push(newPeerElement);
            redrawCanvas();
            break;
        case 'ANNOTATION_MOVE':
            // Peer moved while drawing - find the active element by ID or last active element
            let activePeerEl = null;
            if (message.id) {
                // Try to find by ID first
                activePeerEl = state.peerElements.find(el => el.id === message.id && el.isPeer);
            }
            // Fallback to last active element if ID not found
            if (!activePeerEl) {
                // Find last element that matches the tool type and is active
                for (let i = state.peerElements.length - 1; i >= 0; i--) {
                    const el = state.peerElements[i];
                    if (el.isPeer && el.isActive && el.type === message.tool) {
                        activePeerEl = el;
                        break;
                    }
                }
            }
            // Last resort: use the last peer element
            if (!activePeerEl) {
                const lastEl = state.peerElements[state.peerElements.length - 1];
                if (lastEl && lastEl.isPeer) {
                    activePeerEl = lastEl;
                }
            }
            
            if (activePeerEl) {
                if (message.tool === 'pencil' || message.tool === 'eraser') {
                    activePeerEl.points.push({ x: message.x, y: message.y });
                } else {
                    activePeerEl.end = { x: message.x, y: message.y };
                }
                redrawCanvas();
            } else {
                // Create new element as fallback
                state.peerElements.push({
                    id: message.id || `peer-${Date.now()}-${Math.random()}`,
                    type: message.tool,
                    color: state.color, // Use default color if not provided
                    width: state.strokeWidth, // Use default width if not provided
                    points: [{ x: message.x, y: message.y }],
                    start: { x: message.x, y: message.y },
                    end: { x: message.x, y: message.y },
                    isPeer: true,
                    isActive: true
                });
                redrawCanvas();
            }
            break;
        case 'ANNOTATION_END':
            // Peer finished drawing - mark active element as inactive
            if (message.id) {
                const element = state.peerElements.find(el => el.id === message.id && el.isPeer);
                if (element) {
                    element.isActive = false;
                }
            } else {
                // Mark last active element as inactive
                for (let i = state.peerElements.length - 1; i >= 0; i--) {
                    const el = state.peerElements[i];
                    if (el.isPeer && el.isActive) {
                        el.isActive = false;
                        break;
                    }
                }
            }
            redrawCanvas();
            break;
        case 'ANNOTATION_ELEMENT':
            // Peer added a complete element (e.g., text)
            state.peerElements.push({
                ...message.element,
                isPeer: true
            });
            redrawCanvas();
            break;
        case 'ANNOTATION_CLEAR':
            // Peer cleared canvas
            state.peerElements = [];
            redrawCanvas();
            break;
        case 'ANNOTATION_SYNC':
            // Full state sync
            // Mark all synced elements as not active (they're complete)
            const syncedElements = (message.elements || []).map(el => ({
                ...el,
                isPeer: true,
                isActive: false
            }));
            state.peerElements = syncedElements;
            redrawCanvas();
            break;
    }
}

function setupDataConnection(dataConnection) {
    if (!dataConnection) {
        return;
    }

    // If connection is already open (e.g., peer initiated connection), set state immediately
    // Check both 'open' property and readyState for reliability
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        state.isCollaborating = true;
        updateConnectionStatus(true, state.shareCode);
        
        // Send current canvas state to peer (only if we're the host)
        if (state.isHosting) {
            sendToPeer({
                type: 'ANNOTATION_SYNC',
                elements: state.elements,
                historyStep: state.historyStep
            });
        }
    } else {
        // Connection not open yet, wait for open event
        dataConnection.on('open', () => {
            state.isCollaborating = true;
            updateConnectionStatus(true, state.shareCode);
            
            // Send current canvas state to peer (only if we're the host)
            if (state.isHosting) {
                sendToPeer({
                    type: 'ANNOTATION_SYNC',
                    elements: state.elements,
                    historyStep: state.historyStep
                });
            }
        });
    }

    // Always set up data handlers (regardless of connection state)
    dataConnection.on('data', (data) => {
        try {
            const message = JSON.parse(data);
            handlePeerMessage(message);
        } catch (err) {
            console.error('Error parsing peer message:', err, 'raw data:', data);
        }
    });

    dataConnection.on('close', () => {
        state.dataConnection = null;
        state.isCollaborating = false;
        updateConnectionStatus(false);
    });

    dataConnection.on('error', (err) => {
        console.error('Data connection error, isHosting:', state.isHosting, err);
    });
}

function initiateVideoCall(code) {
    try {
        let streamToShare = null;
        if (state.mode === 'screen' && state.stream) {
            streamToShare = state.stream;
        } else {
            // Create dummy stream for non-screen modes
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            streamToShare = canvas.captureStream ? canvas.captureStream(1) : null;
        }
        
        if (streamToShare && state.peer) {
            state.call = state.peer.call(code, streamToShare);
            
            if (state.call) {
                setupCallHandlers(state.call);
            }
        }
    } catch (err) {
        // Video call failure is not critical if data connection works
    }
}

function attemptConnection(code, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    try {
        // Connect data channel
        state.dataConnection = state.peer.connect(code, {
            reliable: true
        });

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            if (!state.isCollaborating && state.dataConnection) {
                if (state.dataConnection) {
                    state.dataConnection.close();
                    state.dataConnection = null;
                }
                
                if (retryCount < maxRetries) {
                    setTimeout(() => attemptConnection(code, retryCount + 1), retryDelay);
                } else {
                    alert('Could not connect to host after multiple attempts. Please check the share code and try again.');
                    stopCollaboration();
                }
            }
        }, 10000); // 10 second timeout

        state.dataConnection.on('open', () => {
            clearTimeout(connectionTimeout);
            // Store share code for status display
            state.shareCode = code;
            setupDataConnection(state.dataConnection);
            
            // Call for video stream after data connection is established
            setTimeout(() => {
                initiateVideoCall(code);
            }, 500);
        });

        state.dataConnection.on('error', (err) => {
            clearTimeout(connectionTimeout);
            console.error('Data connection error:', err);
            
            if (retryCount < maxRetries) {
                setTimeout(() => attemptConnection(code, retryCount + 1), retryDelay);
            } else {
                alert('Failed to establish connection. Please check the share code and try again.');
                stopCollaboration();
            }
        });

        state.dataConnection.on('close', () => {
            clearTimeout(connectionTimeout);
            if (!state.isCollaborating) {
                if (retryCount < maxRetries) {
                    setTimeout(() => attemptConnection(code, retryCount + 1), retryDelay);
                }
            }
        });

    } catch (err) {
        console.error('Error attempting connection:', err);
        if (retryCount < maxRetries) {
            setTimeout(() => attemptConnection(code, retryCount + 1), retryDelay);
        } else {
            alert('Failed to connect: ' + err.message);
            stopCollaboration();
        }
    }
}

export async function startCollaboration() {
    if (state.isCollaborating) {
        stopCollaboration();
        return;
    }

    try {
        // Generate share code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let shareCode = '';
        for (let i = 0; i < 5; i++) {
            shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        state.peer = new Peer(shareCode, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        state.isHosting = true;
        state.shareCode = shareCode;
        updateConnectionStatus(false, shareCode);

        state.peer.on('open', (id) => {
            // Don't set isCollaborating here - wait for data connection to open
            // This ensures we only mark as collaborating when actually connected
        });

        state.peer.on('connection', (dataConnection) => {
            if (state.dataConnection) {
                dataConnection.close();
                return;
            }
            state.dataConnection = dataConnection;
            setupDataConnection(dataConnection);
        });

        state.peer.on('call', (incomingCall) => {
            if (state.call) {
                // If we already have a call, close the new one
                incomingCall.close();
                return;
            }
            
            // Answer with current screen share if available, otherwise dummy stream
            let streamToShare = null;
            if (state.mode === 'screen' && state.stream) {
                streamToShare = state.stream;
            } else {
                // Create dummy stream for non-screen modes
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                streamToShare = canvas.captureStream ? canvas.captureStream(1) : null;
            }
            
            if (streamToShare) {
                incomingCall.answer(streamToShare);
                state.call = incomingCall;
                setupCallHandlers(incomingCall);
            } else {
                incomingCall.close();
            }
        });

        state.peer.on('error', (err) => {
            console.error('Peer error (host):', err);
            
            // Handle specific errors
            if (err.type === 'peer-unavailable') {
                // This is expected if someone tries to connect before we're ready
            } else if (err.type === 'network') {
                alert('Network error. Please check your internet connection.');
            }
        });

    } catch (err) {
        console.error('Error starting collaboration:', err);
        alert('Failed to start collaboration: ' + err.message);
    }
}

export async function joinCollaborationWithCode(code) {
    if (!code || code.length !== 5) {
        alert('Invalid share code. Please enter a 5-character code.');
        return;
    }

    // Show connecting status
    updateConnectionStatus(false, null);
    const statusText = document.getElementById('connection-text');
    if (statusText) {
        statusText.textContent = 'Connecting...';
    }

    try {
        // Clean up any existing peer
        if (state.peer) {
            state.peer.destroy();
            state.peer = null;
        }

        state.peer = new Peer({
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        let connectionAttempted = false;

        state.peer.on('open', (id) => {
            // Wait a bit to ensure peer is fully ready
            setTimeout(() => {
                if (connectionAttempted) return;
                connectionAttempted = true;
                
                // Connect data channel with retry logic
                attemptConnection(code);
            }, 500);
        });

        state.peer.on('error', (err) => {
            console.error('Peer error:', err);
            
            // Handle specific error types
            if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect')) {
                if (statusText) {
                    statusText.textContent = 'Host not found';
                }
                setTimeout(() => {
                    alert('Could not connect to host. Please check:\n\n1. The share code is correct\n2. The host is still online\n3. Try again in a moment');
                    stopCollaboration();
                }, 1000);
            } else if (err.type === 'network') {
                if (statusText) {
                    statusText.textContent = 'Network error';
                }
                alert('Network error. Please check your internet connection and try again.');
                stopCollaboration();
            } else {
                if (statusText) {
                    statusText.textContent = 'Connection failed';
                }
                alert('Connection error: ' + (err.message || err.type || 'Unknown error'));
                stopCollaboration();
            }
        });

    } catch (err) {
        console.error('Error joining collaboration:', err);
        alert('Failed to join: ' + err.message);
        stopCollaboration();
    }
}

export function stopCollaboration() {
    if (state.dataConnection) {
        state.dataConnection.close();
        state.dataConnection = null;
    }
    if (state.call) {
        state.call.close();
        state.call = null;
    }
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
    state.isCollaborating = false;
    state.isHosting = false;
    state.shareCode = null;
    state.peerElements = [];
    updateConnectionStatus(false);
    redrawCanvas();
}

// Export function for screen sharing integration
export function shareScreenWithPeers(stream) {
    if (!state.isCollaborating || !stream) return;

    // If we're the host and have an active call, replace the track
    if (state.isHosting && state.call && state.call.peerConnection) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const senders = state.call.peerConnection.getSenders();
            const videoSender = senders.find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (videoSender) {
                videoSender.replaceTrack(videoTrack).then(() => {
                }).catch(err => {
                    console.error('Error replacing track:', err);
                    // If replace fails, close and recreate the call
                    recreateCallWithStream(stream);
                });
            } else {
                // No video sender found, recreate call
                recreateCallWithStream(stream);
            }
        }
    } 
    // If we're the host and have data connection but no call, initiate call
    else if (state.isHosting && state.dataConnection && !state.call && state.dataConnection.open) {
        const peerId = state.dataConnection.peer;
        if (peerId && state.peer) {
            state.call = state.peer.call(peerId, stream);
            setupCallHandlers(state.call);
        }
    }
    // If we're a joiner, we should send our stream to the host
    else if (!state.isHosting && state.dataConnection && state.dataConnection.open) {
        const peerId = state.dataConnection.peer;
        if (peerId && state.peer && !state.call) {
            state.call = state.peer.call(peerId, stream);
            setupCallHandlers(state.call);
        } else if (state.call && state.call.peerConnection) {
            // Update existing call
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const senders = state.call.peerConnection.getSenders();
                const videoSender = senders.find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (videoSender) {
                    videoSender.replaceTrack(videoTrack).catch(err => {
                        console.error('Error replacing track as joiner:', err);
                    });
                }
            }
        }
    }
}

function recreateCallWithStream(stream) {
    if (!state.isHosting || !state.dataConnection || !state.dataConnection.open) return;
    
    const peerId = state.dataConnection.peer;
    if (!peerId || !state.peer) return;

    // Close existing call
    if (state.call) {
        state.call.close();
        state.call = null;
    }

    // Create new call with screen stream
    state.call = state.peer.call(peerId, stream);
    setupCallHandlers(state.call);
}

// Make shareScreenWithPeers available globally for screenShare module
window.shareScreenWithPeers = shareScreenWithPeers;

