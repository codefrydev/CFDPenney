// ICE Server Configuration for WebRTC
// Shared between web and desktop applications

export const ICE_SERVERS = [
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
];

export const PEER_CONFIG = {
    debug: 1,
    config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10
    }
};
