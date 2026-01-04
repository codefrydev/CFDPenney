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
        console.log(`Received remote stream from peer ${peerId}`, remoteStream);
        
        // Check if this is a real video stream (not a dummy stream)
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (!videoTrack) {
            console.warn(`No video track in stream from peer ${peerId}`);
            return;
        }
        
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
            return;
        }
        
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
            console.log(`Displaying remote stream from peer ${peerId} in video element`);
            
            // Set the remote stream to the video element
            videoElem.srcObject = remoteStream;
            
            // Ensure video plays
            videoElem.play().catch(err => {
                console.warn('Error playing remote stream:', err);
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
                import('./screenShare.js').then(module => {
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
                    import('./screenShare.js').then(module => {
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
    });

    call.on('error', (err) => {
        console.error(`Call error for peer ${peerId}:`, err);
    });
}

function handlePeerMessage(message, peerId) {
    const senderPeerId = message.peerId || peerId || 'unknown';
    
    // If we're the host, rebroadcast this message to all other peers (except the sender)
    // This ensures all peers see each other's annotations
    if (state.isHosting && senderPeerId !== state.myPeerId) {
        // Don't rebroadcast SYNC messages (those are one-time initial syncs from host)
        if (message.type !== 'ANNOTATION_SYNC') {
            state.dataConnections.forEach((conn, targetPeerId) => {
                // Don't send back to the original sender
                if (targetPeerId !== senderPeerId && conn && conn.open) {
                    try {
                        // Preserve the original peerId so recipients know who sent it
                        const rebroadcastMessage = { ...message, peerId: senderPeerId };
                        conn.send(JSON.stringify(rebroadcastMessage));
                    } catch (err) {
                        console.error(`Error rebroadcasting to peer ${targetPeerId}:`, err);
                    }
                }
            });
        }
    }
    
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

    // Helper function to handle connection open
    const handleConnectionOpen = () => {
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
        
        // If we're the host and screen sharing is active, share it with this peer
        if (state.isHosting && state.mode === 'screen' && state.stream && window.shareScreenWithPeers) {
            // Small delay to ensure peer connection is ready
            setTimeout(() => {
                if (window.shareScreenWithPeers) {
                    window.shareScreenWithPeers(state.stream);
                }
            }, 200);
        } else if (state.isHosting) {
            // Host should initiate video call to peer even if not screen sharing
            // This establishes the media connection for when screen sharing starts
            setTimeout(() => {
                if (state.peer && connectionPeerId && !state.calls.has(connectionPeerId)) {
                    let streamToSend = null;
                    
                    // If screen sharing is active, use that stream
                    if (state.mode === 'screen' && state.stream) {
                        streamToSend = state.stream;
                        console.log(`Host initiating call to peer ${connectionPeerId} with screen stream`);
                    } else {
                        // Create dummy stream for non-screen modes
                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        streamToSend = canvas.captureStream ? canvas.captureStream(1) : null;
                        console.log(`Host initiating call to peer ${connectionPeerId} with dummy stream`);
                    }
                    
                    if (streamToSend) {
                        try {
                            const call = state.peer.call(connectionPeerId, streamToSend);
                            if (call) {
                                state.calls.set(connectionPeerId, call);
                                setupCallHandlers(call, connectionPeerId);
                                console.log(`Host successfully initiated call to peer ${connectionPeerId}`);
                            } else {
                                console.error(`Host failed to create call to peer ${connectionPeerId}`);
                            }
                        } catch (err) {
                            console.error(`Error host initiating call to ${connectionPeerId}:`, err);
                        }
                    } else {
                        console.error(`Host: No stream available to call peer ${connectionPeerId}`);
                    }
                } else {
                    if (state.calls.has(connectionPeerId)) {
                        console.log(`Host: Call to peer ${connectionPeerId} already exists`);
                    }
                }
            }, 500); // Increased delay to ensure peer is ready
        }
    };

    // If connection is already open (e.g., peer initiated connection), set state immediately
    // Check both 'open' property and readyState for reliability
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        handleConnectionOpen();
    } else {
        // Connection not open yet, wait for open event
        dataConnection.on('open', handleConnectionOpen);
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
        
        if (state.peer) {
            // Create call to host (peer initiates call to receive host's stream)
            // Pass null or dummy stream - the host will answer with their stream
            const call = state.peer.call(code, streamToShare || null);
            
            if (call) {
                console.log(`Initiating video call to host ${code}`);
                state.calls.set(code, call);
                
                // Set up handlers to receive the host's stream
                setupCallHandlers(call, code);
                
                // Also listen for stream event (when host answers)
                call.on('stream', (remoteStream) => {
                    console.log(`Received stream from host ${code} via initiated call`);
                    // setupCallHandlers should handle this, but ensure it's processed
                });
            } else {
                console.error('Failed to create call to host');
            }
        } else {
            console.error('No peer instance available to initiate call');
        }
    } catch (err) {
        console.error('Error initiating video call:', err);
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
            
            // As a peer joining, we wait for the host to call us
            // The host will initiate the video call when they receive our data connection
            // We don't need to call initiateVideoCall here - that was for the old flow
            // Instead, we just wait for the host's incoming call
            
            // If we're already screen sharing, we can share it with the host
            if (state.mode === 'screen' && state.stream && window.shareScreenWithPeers) {
                setTimeout(() => {
                    if (window.shareScreenWithPeers) {
                        window.shareScreenWithPeers(state.stream);
                    }
                }, 500);
            }
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
            
            // If screen sharing is already active, share it with peers when they connect
            // This will be handled when connections are established in setupDataConnection
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

        // Listen for incoming calls from the host
        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            console.log(`Peer received incoming call from host ${peerId}`, incomingCall);
            
            // Check if we already have a call from this peer
            if (state.calls.has(peerId)) {
                console.log(`Call from host ${peerId} already exists, closing duplicate`);
                incomingCall.close();
                return;
            }
            
            // Set up handlers FIRST before answering, so we can receive the stream
            state.calls.set(peerId, incomingCall);
            setupCallHandlers(incomingCall, peerId);
            
            // Answer the call - we'll receive the host's stream via the 'stream' event
            // Create a dummy stream to send (or our own screen if sharing)
            let streamToAnswer = null;
            if (state.mode === 'screen' && state.stream) {
                streamToAnswer = state.stream;
            } else {
                // Create dummy stream for non-screen modes
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
            }
            
            if (streamToAnswer) {
                incomingCall.answer(streamToAnswer);
                console.log(`Peer answered call from host ${peerId} with stream:`, streamToAnswer);
            } else {
                console.error('Peer: No stream available to answer call');
                // Still answer even without stream
                try {
                    incomingCall.answer();
                } catch (e) {
                    console.error('Error answering call without stream:', e);
                }
            }
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

