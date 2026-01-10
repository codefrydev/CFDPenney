// ================= SESSION DISCOVERY =================
// Peer-to-peer session discovery using a fixed discovery peer
import { DISCOVERY_PEER_ID, ANNONATE_PLATFORM_ID, SESSION_TIMEOUT } from './config.js';

let discoveryPeer = null;
let discoveryDataConnection = null;
let sessionRegistry = new Map(); // code -> {code, timestamp, name?, mode, platform, connected}
let isDiscoveryHost = false;
let discoveryCleanupInterval = null;

// Cleanup old sessions periodically
function cleanupOldSessions() {
  const now = Date.now();
  for (const [code, session] of sessionRegistry.entries()) {
    if (now - session.timestamp > SESSION_TIMEOUT) {
      sessionRegistry.delete(code);
    }
  }
}

// Start as discovery host (maintains the registry)
export function startDiscoveryHost() {
  if (discoveryPeer) {
    return; // Already started
  }


  discoveryPeer = new Peer(DISCOVERY_PEER_ID, {
    debug: 0,
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
      ]
    }
  });

  discoveryPeer.on('open', (id) => {
    isDiscoveryHost = true; // Only set to true after successful open
    
    // Start cleanup interval
    discoveryCleanupInterval = setInterval(cleanupOldSessions, 30000); // Every 30 seconds
  });

  discoveryPeer.on('connection', (dataConnection) => {
    
    dataConnection.on('open', () => {
    });

    dataConnection.on('data', (data) => {
      try {
        const message = JSON.parse(data);
        handleDiscoveryMessage(message, dataConnection);
      } catch (err) {
        console.error('Error parsing discovery message:', err);
      }
    });

    dataConnection.on('close', () => {
    });

    dataConnection.on('error', (err) => {
      console.error('Discovery connection error:', err);
    });
  });

  discoveryPeer.on('error', (err) => {
    // If ID is taken, we're not the host - that's expected, not an error
    if (err.type === 'peer-unavailable' || err.message?.includes('ID is taken') || err.type === 'unavailable-id' || err.type === 'socket-error') {
      // Silently handle - this is expected when discovery peer already exists
      isDiscoveryHost = false;
      // Don't stop the peer yet - let it clean up naturally
      // The error handler will prevent it from being used as host
    } else {
      // Only log actual unexpected errors
    }
  });
}

// Stop discovery host
export function stopDiscoveryHost() {
  if (discoveryCleanupInterval) {
    clearInterval(discoveryCleanupInterval);
    discoveryCleanupInterval = null;
  }

  if (discoveryDataConnection) {
    discoveryDataConnection.close();
    discoveryDataConnection = null;
  }

  if (discoveryPeer) {
    discoveryPeer.destroy();
    discoveryPeer = null;
  }

  isDiscoveryHost = false;
  sessionRegistry.clear();
}

// Handle messages from clients
function handleDiscoveryMessage(message, dataConnection) {
  switch (message.type) {
    case 'register':
      // Only register if it's an Annonate session (has platform identifier)
      if (message.platform !== ANNONATE_PLATFORM_ID) {
        break;
      }
      
      // Register a new session (only if not already registered or if re-registering)
      sessionRegistry.set(message.code, {
        code: message.code,
        timestamp: message.timestamp || Date.now(),
        name: message.name,
        platform: message.platform || ANNONATE_PLATFORM_ID,
        mode: message.mode || 'whiteboard', // Store mode: 'whiteboard', 'screen', 'image'
        connected: false // Track if this session is already connected
      });
      
      // Send confirmation
      dataConnection.send(JSON.stringify({
        type: 'register_ack',
        code: message.code,
        success: true
      }));
      break;

    case 'mark_connected':
      // Mark a session as connected
      const connectedSession = sessionRegistry.get(message.code);
      if (connectedSession) {
        connectedSession.connected = true;
      }
      break;

    case 'mark_available':
      // Mark a session as available
      const availableSession = sessionRegistry.get(message.code);
      if (availableSession) {
        availableSession.connected = false;
      }
      break;

    case 'unregister':
      // Unregister a session
      sessionRegistry.delete(message.code);
      break;

    case 'list':
      // Only send Annonate sessions if request includes platform identifier
      const requestPlatform = message.platform || '';
      const isAnnonateRequest = requestPlatform === ANNONATE_PLATFORM_ID;
      
      // Send list of active sessions (only Annonate ones, available, and not connected)
      // Filter by mode if requested
      const requestMode = message.mode || null;
      const sessions = Array.from(sessionRegistry.values())
        .filter(session => {
          const isRecent = Date.now() - session.timestamp < SESSION_TIMEOUT;
          const isAvailable = !session.connected;
          const isAnnonate = (session.platform === ANNONATE_PLATFORM_ID) || (!session.platform && isAnnonateRequest);
          // Strict mode matching - if requestMode is specified, session must have matching mode
          // Default to 'whiteboard' only if mode is not specified in request
          const sessionMode = session.mode || 'whiteboard';
          const matchingMode = !requestMode || sessionMode === requestMode;
          // Only return Annonate sessions if request is from Annonate, and matching mode
          return isRecent && isAvailable && isAnnonate && matchingMode;
        })
        .map(session => ({
          code: session.code,
          timestamp: session.timestamp,
          name: session.name,
          mode: session.mode || 'whiteboard' // Include mode in response
        }));
      
      dataConnection.send(JSON.stringify({
        type: 'list_response',
        sessions: sessions
      }));
      break;

    default:
  }
}

// Track active discovery connections to prevent duplicates
let activeDiscoveryConnections = new Set();

// Connect to discovery peer as client
// mode: optional filter - 'whiteboard', 'screen', or 'image' to only get sessions of that mode
export function connectToDiscovery(onSessionsReceived, mode) {
  return new Promise((resolve, reject) => {
    // First, try to start as host (in case no one else is)
    startDiscoveryHost();
    
    // Wait a bit to see if we become the host (give it time to initialize or error)
    setTimeout(() => {
      if (isDiscoveryHost) {
        // We're the host, return our registry (only Annonate available sessions)
        // Filter by mode if provided
        const sessions = Array.from(sessionRegistry.values())
          .filter(session => {
            const isRecent = Date.now() - session.timestamp < SESSION_TIMEOUT;
            const isAvailable = !session.connected;
            const isAnnonate = session.platform === ANNONATE_PLATFORM_ID;
            // Strict mode matching - if mode is specified, session must have matching mode
            const sessionMode = session.mode || 'whiteboard';
            const matchingMode = !mode || sessionMode === mode;
            return isRecent && isAvailable && isAnnonate && matchingMode;
          })
          .map(session => ({
            code: session.code,
            timestamp: session.timestamp,
            name: session.name,
            mode: session.mode || 'whiteboard'
          }));
        
        if (onSessionsReceived) {
          onSessionsReceived(sessions);
        }
        resolve(sessions);
        return;
      }

      // Connect as client
      const connectionId = Date.now() + Math.random();
      if (activeDiscoveryConnections.has(connectionId)) {
        // Already have an active connection, wait for it
        return;
      }
      activeDiscoveryConnections.add(connectionId);
      
      const clientPeer = new Peer({
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      clientPeer.on('open', () => {
        
        try {
          const dataConnection = clientPeer.connect(DISCOVERY_PEER_ID, {
            reliable: true
          });

          dataConnection.on('open', () => {
            discoveryDataConnection = dataConnection;

            // Request session list with Annonate platform identifier and mode
            const listRequest = { 
              type: 'list',
              platform: ANNONATE_PLATFORM_ID
            };
            if (mode) {
              listRequest.mode = mode; // Include mode to filter
            }
            dataConnection.send(JSON.stringify(listRequest));

            // Listen for responses
            dataConnection.on('data', (data) => {
              try {
                const message = JSON.parse(data);
                if (message.type === 'list_response') {
                  // Add mode to each session if not present
                  const sessionsWithMode = message.sessions.map(s => ({
                    ...s,
                    mode: s.mode || 'whiteboard'
                  }));
                  if (onSessionsReceived) {
                    onSessionsReceived(sessionsWithMode);
                  }
                  resolve(sessionsWithMode);
                  
                  // Close connection after receiving list
                  setTimeout(() => {
                    dataConnection.close();
                    clientPeer.destroy();
                    activeDiscoveryConnections.delete(connectionId);
                  }, 1000);
                }
              } catch (err) {
                console.error('Error parsing discovery response:', err);
                activeDiscoveryConnections.delete(connectionId);
              }
            });
          });

          dataConnection.on('error', (err) => {
            console.error('Discovery data connection error:', err);
            activeDiscoveryConnections.delete(connectionId);
            reject(err);
          });

          dataConnection.on('close', () => {
            activeDiscoveryConnections.delete(connectionId);
          });

        } catch (err) {
          console.error('Error connecting to discovery peer:', err);
          activeDiscoveryConnections.delete(connectionId);
          reject(err);
        }
      });

      clientPeer.on('error', (err) => {
        console.error('Client peer error:', err);
        // If discovery peer doesn't exist, we become the host
        if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect')) {
          stopDiscoveryHost();
          startDiscoveryHost();
          
          // Return empty list since we're the first
          const sessions = [];
          if (onSessionsReceived) {
            onSessionsReceived(sessions);
          }
          resolve(sessions);
        } else {
          reject(err);
        }
      });
    }, 500);
  });
}

// Register a session with discovery service
export function registerSession(code, name, mode) {
  if (isDiscoveryHost) {
    // We're the host, add directly with Annonate platform identifier
    sessionRegistry.set(code, {
      code: code,
      timestamp: Date.now(),
      name: name,
      platform: ANNONATE_PLATFORM_ID,
      mode: mode || 'whiteboard', // Store mode: 'whiteboard', 'screen', 'image'
      connected: false
    });
    return Promise.resolve();
  }

  // Connect and register
  return new Promise((resolve, reject) => {
    const clientPeer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    clientPeer.on('open', () => {
      try {
        const dataConnection = clientPeer.connect(DISCOVERY_PEER_ID, {
          reliable: true
        });

        dataConnection.on('open', () => {
          // Send registration with Annonate platform identifier and mode
          dataConnection.send(JSON.stringify({
            type: 'register',
            code: code,
            timestamp: Date.now(),
            name: name,
            platform: ANNONATE_PLATFORM_ID,
            mode: mode || 'whiteboard' // Include mode in registration
          }));

          // Wait for acknowledgment
          dataConnection.on('data', (data) => {
            try {
              const message = JSON.parse(data);
              if (message.type === 'register_ack' && message.code === code) {
                resolve();
                
                // Keep connection open for unregister later
                // Store it for cleanup
                setTimeout(() => {
                  // Close after a short delay
                  dataConnection.close();
                  clientPeer.destroy();
                }, 100);
              }
            } catch (err) {
              console.error('Error parsing registration ack:', err);
            }
          });
        });

        dataConnection.on('error', (err) => {
          console.error('Registration connection error:', err);
          // If discovery peer doesn't exist, start as host and register
          if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect')) {
            startDiscoveryHost();
            registerSession(code, name, mode).then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });

      } catch (err) {
        console.error('Error creating registration connection:', err);
        reject(err);
      }
    });

    clientPeer.on('error', (err) => {
      // If discovery peer doesn't exist, start as host (expected behavior)
      if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect')) {
        // This is expected when no discovery host exists - we'll become the host
        startDiscoveryHost();
        registerSession(code, name, mode).then(resolve).catch(reject);
      } else {
        // Only log actual errors (not expected fallback scenarios)
        console.error('Registration peer error:', err);
        reject(err);
      }
    });
  });
}

// Mark a session as connected (so it won't be available for new connections)
export function markSessionConnected(code) {
  if (isDiscoveryHost) {
    // We're the host, update directly
    const session = sessionRegistry.get(code);
    if (session) {
      session.connected = true;
    }
    return Promise.resolve();
  }

  // Connect and mark as connected
  return new Promise((resolve, reject) => {
    const clientPeer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    clientPeer.on('open', () => {
      try {
        const dataConnection = clientPeer.connect(DISCOVERY_PEER_ID, {
          reliable: true
        });

        dataConnection.on('open', () => {
          dataConnection.send(JSON.stringify({
            type: 'mark_connected',
            code: code
          }));
          
          setTimeout(() => {
            dataConnection.close();
            clientPeer.destroy();
            resolve();
          }, 500);
        });
      } catch (err) {
        clientPeer.destroy();
        reject(err);
      }
    });

    clientPeer.on('error', () => {
      clientPeer.destroy();
      resolve(); // Silently fail, don't block
    });
  });
}

// Mark a session as available (so it can accept new connections)
export function markSessionAvailable(code) {
  if (isDiscoveryHost) {
    // We're the host, update directly
    const session = sessionRegistry.get(code);
    if (session) {
      session.connected = false;
    }
    return Promise.resolve();
  }

  // Connect and mark as available
  return new Promise((resolve, reject) => {
    const clientPeer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    clientPeer.on('open', () => {
      try {
        const dataConnection = clientPeer.connect(DISCOVERY_PEER_ID, {
          reliable: true
        });

        dataConnection.on('open', () => {
          dataConnection.send(JSON.stringify({
            type: 'mark_available',
            code: code
          }));
          
          setTimeout(() => {
            dataConnection.close();
            clientPeer.destroy();
            resolve();
          }, 500);
        });
      } catch (err) {
        clientPeer.destroy();
        reject(err);
      }
    });

    clientPeer.on('error', () => {
      clientPeer.destroy();
      resolve(); // Silently fail, don't block
    });
  });
}

// Unregister a session
export function unregisterSession(code) {
  if (isDiscoveryHost) {
    // We're the host, remove directly
    sessionRegistry.delete(code);
    return;
  }

  // Try to connect and unregister (best effort, don't block)
  const clientPeer = new Peer({
    debug: 0,
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
      ]
    }
  });

  clientPeer.on('open', () => {
    try {
      const dataConnection = clientPeer.connect(DISCOVERY_PEER_ID, {
        reliable: true
      });

      dataConnection.on('open', () => {
        dataConnection.send(JSON.stringify({
          type: 'unregister',
          code: code
        }));
        
        setTimeout(() => {
          dataConnection.close();
          clientPeer.destroy();
        }, 500);
      });
    } catch (err) {
      // Silently fail
      clientPeer.destroy();
    }
  });

  clientPeer.on('error', () => {
    // Silently fail
    clientPeer.destroy();
  });
}

