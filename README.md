# CFD Penney

**Collaborative Annotation Tool for Real-Time Drawing, Screen Sharing, and Image Annotation**

CFD Penney is a free, web-based collaborative annotation tool that enables real-time drawing, screen sharing, and image annotation. Perfect for teams, educators, and anyone who needs to collaborate visually.

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/codefrydev/CFDPenney)

### 🌐 Live Demo

**Production URL:** [https://codefrydev.in/CFDPenney](https://codefrydev.in/CFDPenney)

> **Note:** Peer-to-peer connections are currently not working in production but work correctly when running locally. For full collaboration features, please run the application locally as described in the [Installation](#installation) section.

## Features

### 🎨 Drawing Tools
- **Pen Tool** - Freehand drawing with customizable stroke width
- **Eraser** - Remove parts of your drawing
- **Text Tool** - Add text annotations
- **Shape Tools** - Line, Arrow, Rectangle, Circle, Ellipse, Triangle, Diamond, Star, Pentagon, Hexagon, Octagon
- **Fill Support** - Fill shapes with custom colors
- **Stickers** - Add fun stickers to your canvas
- **Select Tool** - Select and manipulate drawn elements

### 🖼️ Three Annotation Modes
- **Board Mode** - Clean whiteboard for freeform drawing
- **Screen Mode** - Share and annotate your screen in real-time
- **Image Mode** - Upload and annotate images

### 👥 Collaboration
- **Real-Time Collaboration** - Multiple users can draw simultaneously
- **Room-Based System** - 5-character room codes for easy sharing
- **Peer-to-Peer** - Direct connections using WebRTC
- **Session Discovery** - Find and join active sessions
- **Connection Status** - Visual indicators for connection state

### 🎯 Additional Features
- **Undo/Redo** - Full history management
- **Snapshot Export** - Capture and download your canvas
- **Dark/Light Theme** - Toggle between themes
- **Color Picker** - Preset colors and custom color selection
- **Stroke Width Control** - Adjustable line thickness
- **Responsive Design** - Works on desktop, tablet, and mobile devices

## Getting Started

### Prerequisites

- Modern web browser with JavaScript enabled
- HTML5 and WebRTC support
- For screen sharing: Browser permissions for screen capture

### Installation

CFD Penney is a client-side web application. No server setup is required for basic functionality.

1. Clone the repository:
```bash
git clone https://github.com/codefrydev/CFDPenney.git
cd CFDPenney
```

2. Serve the files using a local web server:

**Using Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Using Node.js (http-server):**
```bash
npx http-server -p 8000
```

**Using PHP:**
```bash
php -S localhost:8000
```

3. Open your browser and navigate to `http://localhost:8000`

### Deployment

For production deployment, simply upload all files to a web server that supports static file hosting. The application works entirely client-side.

**Recommended Hosting Options:**
- GitHub Pages
- Netlify
- Vercel
- Any static file hosting service

## Usage Guide

### Starting a Collaboration Session

1. Click the **"Collaborate"** button in the header
2. Click **"Host Session"** to create a new room
3. A 5-character room code will be generated (e.g., `A3K7M`)
4. Share this code with others to invite them to your session

### Joining a Session

1. Click the **"Collaborate"** button
2. Enter the 5-character room code in the input field
3. Click **"Join"** to connect to the session

Alternatively, you can join directly via URL by appending the room code:
```
https://codefrydev.in/CFDPenney/?code=A3K7M
```

### Drawing Tools

- **Select a tool** from the left sidebar
- **Choose a color** from the color palette or use the custom color picker
- **Adjust stroke width** by hovering over the stroke indicator at the bottom of the sidebar
- **For shapes**: Toggle fill on/off and select a fill color

### Mode Switching

- **Board Mode** - Click the "Board" button for a clean whiteboard
- **Screen Mode** - Click "Screen" to share your screen (requires browser permissions)
- **Image Mode** - Click "Image" to upload and annotate an image file

### Screen Sharing

1. Click the **"Screen"** mode button
2. Grant browser permissions when prompted
3. Select the screen/window/tab you want to share
4. Your screen will appear as the background for annotation
5. Use the controls at the bottom to pause or stop sharing

### Keyboard Shortcuts

- **Undo**: Click the undo button (or use browser's undo if available)
- **Redo**: Click the redo button
- **Clear**: Click the trash icon to clear the entire canvas

## Technical Details

### Technology Stack

- **Vanilla JavaScript (ES6 Modules)** - Core application logic
- **PeerJS** - Peer-to-peer WebRTC connections
- **HTML5 Canvas** - Drawing and rendering
- **Tailwind CSS** - Styling and responsive design
- **Lucide Icons** - Icon library

### Architecture

The application follows a modular architecture:

```
js/
├── main.js                 # Application entry point
├── state.js                # Global state management
├── config.js               # Configuration constants
├── canvas.js               # Canvas rendering
├── drawing.js              # Drawing logic
├── tools.js                # Tool management
├── collaboration.js        # Collaboration API
├── collaboration/
│   ├── collaborationCore.js    # Core collaboration lifecycle
│   ├── dataConnection.js       # Data channel management
│   ├── videoCall.js            # Screen sharing
│   ├── messageHandler.js       # Message processing
│   ├── messageSender.js        # Message sending
│   ├── connectionStatus.js     # Connection UI updates
│   ├── coordinateUtils.js      # Coordinate normalization
│   └── urlUtils.js             # URL code handling
├── shapes/                 # Shape tools
├── stickers/               # Sticker system
├── selection/              # Selection and manipulation
└── ...                     # Other modules
```

### Key Dependencies

The application uses CDN-hosted dependencies:

- **PeerJS** (`https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js`) - WebRTC abstraction
- **Tailwind CSS** (`https://cdn.tailwindcss.com`) - Utility-first CSS framework
- **Lucide Icons** (`https://unpkg.com/lucide@latest`) - Icon library

### State Management

The application uses a centralized state object (`state.js`) that manages:
- Current tool selection
- Drawing state (isDrawing, currentPath, etc.)
- Collaboration state (peer connections, room code)
- Canvas history (undo/redo)
- Theme preferences
- Mode (board/screen/image)

## Collaboration Setup

### How It Works

CFD Penney uses **PeerJS** for peer-to-peer WebRTC connections:

1. **Host creates a session** - Generates a unique 5-character room code
2. **PeerJS connection** - Host's peer ID becomes the room code
3. **Joiners connect** - Other users connect using the room code as the peer ID
4. **Data channels** - Real-time bidirectional data channels sync drawing actions
5. **Screen sharing** - Video streams are shared via WebRTC media channels

### TURN/STUN Server Configuration

The application uses the following ICE servers for WebRTC connections:

**STUN Servers:**
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

**TURN Servers:**
- `turn:openrelay.metered.ca:80` (with credentials)
- `turn:openrelay.metered.ca:443` (with credentials)

These servers are configured in `js/collaboration/collaborationCore.js`. To use custom TURN/STUN servers, modify the `iceServers` array in the PeerJS configuration.

**Note:** For production deployments behind restrictive firewalls or NAT, you may need to configure your own TURN servers for reliable connections.

### Connection Troubleshooting

If you experience connection issues:

1. **Check browser console** - Look for PeerJS error messages
2. **Verify TURN servers** - Ensure TURN servers are accessible
3. **Check firewall/NAT** - Some networks block WebRTC traffic
4. **Try different network** - Test on a different network to isolate issues
5. **Browser permissions** - Ensure camera/microphone permissions are granted if needed

### Known Issues

- **Production Environment**: Peer-to-peer connections are not working on the production deployment at [https://codefrydev.in/CFDPenney](https://codefrydev.in/CFDPenney). Collaboration features work correctly when running the application locally. This may be due to:
  - PeerJS signaling server connectivity issues
  - Network/firewall restrictions on the production server
  - HTTPS/WSS protocol requirements for WebRTC in production
  
  **Workaround**: Run the application locally using the installation instructions above for full collaboration functionality.

### Discovery Service

The application includes a peer-to-peer discovery service that allows users to find active sessions. The discovery service uses a fixed peer ID (`ANNONATE_DISCOVERY_de97662b-caa7-46a6-aca7-68410515c969`) that acts as a central registry.

- Sessions are registered with a 5-minute timeout
- The first user to connect becomes the discovery host
- Other users can query available sessions

## Browser Support

### Supported Browsers

- **Chrome/Chromium** (Recommended) - Full support
- **Firefox** - Full support
- **Safari** - Full support (iOS 11+)
- **Edge** - Full support

### Required Permissions

- **Screen Sharing** - Required for Screen mode
- **Camera/Microphone** - Not required (no video/audio chat)

### Mobile Support

CFD Penney is responsive and works on mobile devices:
- Touch-friendly interface
- Responsive layout adapts to screen size
- Canvas supports touch input
- Some features may have limited functionality on mobile

## Project Structure

```
Annonate/
├── index.html              # Main HTML file
├── js/                     # JavaScript modules
│   ├── main.js             # Entry point
│   ├── state.js            # State management
│   ├── config.js           # Configuration
│   ├── canvas.js           # Canvas operations
│   ├── drawing.js          # Drawing logic
│   ├── tools.js            # Tool management
│   ├── collaboration.js    # Collaboration API
│   ├── collaboration/      # Collaboration modules
│   ├── shapes/             # Shape tools
│   ├── stickers/           # Sticker system
│   ├── selection/          # Selection tools
│   └── ...                 # Other modules
├── styles/                 # CSS files
│   ├── main.css            # Main styles
│   ├── base.css            # Base styles
│   ├── variables.css       # CSS variables
│   └── ...                 # Other style files
├── favicon-32x32.png       # Favicon
├── og-image.jpg            # Open Graph image
├── robots.txt              # SEO robots file
├── sitemap.xml             # SEO sitemap
└── README.md               # This file
```

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test your changes across different browsers
- Ensure mobile responsiveness

## License

This project is open source. Please check the repository for specific license information.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/codefrydev/CFDPenney).

## Acknowledgments

- Built with [PeerJS](https://peerjs.com/) for WebRTC functionality
- Icons by [Lucide](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

**CFD Penney** - Collaborate visually, anywhere, anytime.

