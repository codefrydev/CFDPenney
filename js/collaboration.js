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
    
    // Get peer count
    const peerCount = state.connectedPeers.size;
    const peerList = Array.from(state.connectedPeers.keys());
    
    if (isConnected) {
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#10b981'; // green
        
        // Build status text with peer count
        let displayText = statusText || 'Connected';
        if (peerCount > 0) {
            if (state.isHosting) {
                displayText = `Connected (${peerCount} ${peerCount === 1 ? 'user' : 'users'})`;
            } else {
                displayText = 'Connected to host';
            }
        }
        textEl.textContent = displayText;
        
        // Add tooltip with peer list if there are peers
        if (peerCount > 0 && state.isHosting) {
            const peerListText = peerList.map(id => id.substring(0, 8)).join(', ');
            textEl.title = `Connected peers: ${peerListText}`;
        } else {
            textEl.title = '';
        }
        
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
        textEl.textContent = statusText || (state.isHosting ? 'Waiting for peers...' : 'Waiting for peer...');
        textEl.title = '';
        codeEl.textContent = shareCode;
        codeEl.classList.remove('hidden');
        btnEl.innerHTML = '<i data-lucide="users" class="w-4 h-4 inline mr-1"></i><span class="hidden sm:inline">Stop</span>';
    } else if (statusText) {
        // Show status even without share code (e.g., "Connecting...")
        statusEl.classList.remove('hidden');
        dotEl.style.backgroundColor = '#3b82f6'; // blue for connecting
        textEl.textContent = statusText;
        textEl.title = '';
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

// Send message to all connected peers
export function sendToAllPeers(message) {
    if (!state.isCollaborating) {
        return 0;
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    let sentCount = 0;
    state.dataConnections.forEach((conn, peerId) => {
        if (conn && conn.open) {
            try {
                const messageStr = JSON.stringify(message);
                conn.send(messageStr);
                sentCount++;
            } catch (err) {
                console.error(`Error sending to peer ${peerId}:`, err);
            }
        }
    });
    return sentCount;
}

// Send message to a specific peer (or all if peerId not provided)
export function sendToPeer(message, peerId = null) {
    if (!state.isCollaborating) {
        return false;
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    if (peerId) {
        // Send to specific peer
        const conn = state.dataConnections.get(peerId);
        if (conn && conn.open) {
            try {
                const messageStr = JSON.stringify(message);
                conn.send(messageStr);
                return true;
            } catch (err) {
                console.error(`sendToPeer: Error sending to peer ${peerId}:`, err);
                return false;
            }
        }
        return false;
    } else {
        // If no peerId specified, broadcast to all (for backward compatibility)
        return sendToAllPeers(message) > 0;
    }
}

function setupCallHandlers(call, peerId) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
        // Handle remote stream - could display it in a separate video element
        // For now, we'll just log it since the main screen share is shown locally
    });

    call.on('close', () => {
        if (peerId && state.calls.has(peerId)) {
            state.calls.delete(peerId);
        }
    });

    call.on('error', (err) => {
        console.error(`Call error for peer ${peerId}:`, err);
    });
}

function handlePeerMessage(message, peerId) {
    const senderPeerId = message.peerId || peerId || 'unknown';
    
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
                isActive: true, // Mark as active drawing
                peerId: senderPeerId // Track which peer created this
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
                    isActive: true,
                    peerId: senderPeerId
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
                isPeer: true,
                peerId: senderPeerId
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
                isActive: false,
                peerId: senderPeerId // Elements from sync are from the host
            }));
            state.peerElements = syncedElements;
            redrawCanvas();
            break;
    }
}

function setupDataConnection(dataConnection, peerId) {
    if (!dataConnection) {
        return;
    }

    const connectionPeerId = peerId || dataConnection.peer;

    // If connection is already open (e.g., peer initiated connection), set state immediately
    // Check both 'open' property and readyState for reliability
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        state.isCollaborating = true;
        updateConnectionStatus(true, state.shareCode);
        
        // Send current canvas state to new peer (only if we're the host)
        // Use sendToPeer for targeted message to this specific peer
        if (state.isHosting) {
            sendToPeer({
                type: 'ANNOTATION_SYNC',
                elements: state.elements,
                historyStep: state.historyStep
            }, connectionPeerId);
        }
    } else {
        // Connection not open yet, wait for open event
        dataConnection.on('open', () => {
            state.isCollaborating = true;
            updateConnectionStatus(true, state.shareCode);
            
            // Send current canvas state to new peer (only if we're the host)
            // Use sendToPeer for targeted message to this specific peer
            if (state.isHosting) {
                sendToPeer({
                    type: 'ANNOTATION_SYNC',
                    elements: state.elements,
                    historyStep: state.historyStep
                }, connectionPeerId);
            }
        });
    }

    // Always set up data handlers (regardless of connection state)
    dataConnection.on('data', (data) => {
        try {
            const message = JSON.parse(data);
            handlePeerMessage(message, connectionPeerId);
        } catch (err) {
            console.error('Error parsing peer message:', err, 'raw data:', data);
        }
    });

    dataConnection.on('close', () => {
        // Remove peer from all Maps
        if (connectionPeerId) {
            state.dataConnections.delete(connectionPeerId);
            state.calls.delete(connectionPeerId);
            state.connectedPeers.delete(connectionPeerId);
        }
        
        // Update collaboration status - check if any connections remain
        if (state.dataConnections.size === 0) {
            state.isCollaborating = false;
            updateConnectionStatus(false);
        } else {
            // Still have other connections, just update status
            updateConnectionStatus(true, state.shareCode);
        }
    });

    dataConnection.on('error', (err) => {
        console.error(`Data connection error for peer ${connectionPeerId}, isHosting:`, state.isHosting, err);
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
            const call = state.peer.call(code, streamToShare);
            
            if (call) {
                state.calls.set(code, call);
                setupCallHandlers(call, code);
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
        const dataConnection = state.peer.connect(code, {
            reliable: true
        });
        
        // Store connection in Map (for joiners, there's only one connection)
        state.dataConnections.set(code, dataConnection);
        state.connectedPeers.set(code, {
            id: code,
            connectedAt: Date.now()
        });

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            if (!state.isCollaborating && dataConnection) {
                if (dataConnection) {
                    dataConnection.close();
                    state.dataConnections.delete(code);
                    state.connectedPeers.delete(code);
                }
                
                if (retryCount < maxRetries) {
                    setTimeout(() => attemptConnection(code, retryCount + 1), retryDelay);
                } else {
                    alert('Could not connect to host after multiple attempts. Please check the share code and try again.');
                    stopCollaboration();
                }
            }
        }, 10000); // 10 second timeout

        dataConnection.on('open', () => {
            clearTimeout(connectionTimeout);
            // Store share code for status display
            state.shareCode = code;
            setupDataConnection(dataConnection, code);
            
            // Call for video stream after data connection is established
            setTimeout(() => {
                initiateVideoCall(code);
            }, 500);
        });

        dataConnection.on('error', (err) => {
            clearTimeout(connectionTimeout);
            console.error('Data connection error:', err);
            
            state.dataConnections.delete(code);
            state.connectedPeers.delete(code);
            
            if (retryCount < maxRetries) {
                setTimeout(() => attemptConnection(code, retryCount + 1), retryDelay);
            } else {
                alert('Failed to establish connection. Please check the share code and try again.');
                stopCollaboration();
            }
        });

        dataConnection.on('close', () => {
            clearTimeout(connectionTimeout);
            state.dataConnections.delete(code);
            state.connectedPeers.delete(code);
            
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
            // Store our peer ID
            state.myPeerId = id;
            // Don't set isCollaborating here - wait for data connection to open
            // This ensures we only mark as collaborating when actually connected
        });

        state.peer.on('connection', (dataConnection) => {
            const peerId = dataConnection.peer;
            
            // Check if we already have a connection from this peer
            if (state.dataConnections.has(peerId)) {
                console.log(`Connection from peer ${peerId} already exists, closing duplicate`);
                dataConnection.close();
                return;
            }
            
            // Store the connection
            state.dataConnections.set(peerId, dataConnection);
            state.connectedPeers.set(peerId, {
                id: peerId,
                connectedAt: Date.now()
            });
            
            setupDataConnection(dataConnection, peerId);
        });

        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check if we already have a call from this peer
            if (state.calls.has(peerId)) {
                console.log(`Call from peer ${peerId} already exists, closing duplicate`);
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
                state.calls.set(peerId, incomingCall);
                setupCallHandlers(incomingCall, peerId);
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
            // Store our peer ID
            state.myPeerId = id;
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
    // Close all data connections
    state.dataConnections.forEach((conn, peerId) => {
        if (conn) {
            conn.close();
        }
    });
    state.dataConnections.clear();
    
    // Close all calls
    state.calls.forEach((call, peerId) => {
        if (call) {
            call.close();
        }
    });
    state.calls.clear();
    
    // Clear peer tracking
    state.connectedPeers.clear();
    
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
    state.isCollaborating = false;
    state.isHosting = false;
    state.shareCode = null;
    state.peerElements = [];
    state.myPeerId = null;
    updateConnectionStatus(false);
    redrawCanvas();
}

// Export function for screen sharing integration
export function shareScreenWithPeers(stream) {
    if (!state.isCollaborating || !stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    // If we're the host, broadcast to all connected peers
    if (state.isHosting) {
        state.dataConnections.forEach((conn, peerId) => {
            if (conn && conn.open) {
                const existingCall = state.calls.get(peerId);
                
                if (existingCall && existingCall.peerConnection) {
                    // Update existing call
                    const senders = existingCall.peerConnection.getSenders();
                    const videoSender = senders.find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    
                    if (videoSender) {
                        videoSender.replaceTrack(videoTrack).catch(err => {
                            console.error(`Error replacing track for peer ${peerId}:`, err);
                            // If replace fails, recreate the call
                            recreateCallWithStream(stream, peerId);
                        });
                    } else {
                        // No video sender found, recreate call
                        recreateCallWithStream(stream, peerId);
                    }
                } else {
                    // No call exists, create new one
                    if (state.peer) {
                        const call = state.peer.call(peerId, stream);
                        if (call) {
                            state.calls.set(peerId, call);
                            setupCallHandlers(call, peerId);
                        }
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
                // Update existing call
                const senders = existingCall.peerConnection.getSenders();
                const videoSender = senders.find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (videoSender) {
                    videoSender.replaceTrack(videoTrack).catch(err => {
                        console.error('Error replacing track as joiner:', err);
                    });
                }
            } else if (state.peer && !existingCall) {
                // Create new call to host
                const call = state.peer.call(hostPeerId, stream);
                if (call) {
                    state.calls.set(hostPeerId, call);
                    setupCallHandlers(call, hostPeerId);
                }
            }
        }
    }
}

function recreateCallWithStream(stream, peerId) {
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

// Make shareScreenWithPeers available globally for screenShare module
window.shareScreenWithPeers = shareScreenWithPeers;

