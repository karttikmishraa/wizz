[README.md](https://github.com/user-attachments/files/28969143/README.md)
# WizzCall 🎙️

WizzCall is a modern, real-time anonymous 1-on-1 voice chat web application inspired by Omegle. Connect with random strangers worldwide instantly, completely anonymously.

## Features ✨

- **Instant Matchmaking**: Connect with a random online stranger in seconds.
- **Peer-to-Peer Audio**: High-quality voice chat using WebRTC. Audio streams directly between browsers and never touches the server.
- **Anonymous & Safe**: No accounts required. Auto-generated fun nicknames (e.g., "SwiftFalcon42").
- **Live Audio Visualizer**: See the voice activity with a neon sound visualizer.
- **Icebreakers**: Fun conversation starters provided at the beginning of each match.
- **Premium UI**: Dark mode glassmorphism design with animated neon backgrounds.
- **Responsive**: Works perfectly on both desktop and mobile devices.

## Tech Stack 🛠️

- **Frontend**: HTML5, Vanilla CSS3, JavaScript
- **Backend**: Node.js, Express
- **Real-Time Signaling**: Socket.IO
- **Audio Protocol**: WebRTC & Web Audio API
- **Security**: node-forge (Auto-generates self-signed SSL certificates for local testing to allow mobile microphone access)

## How to Run Locally 🚀

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### Installation
1. Clone this repository or download the files.
2. Open a terminal inside the project folder.
3. Install the required dependencies:
   ```bash
   npm install
   ```

### Starting the Server
Run the following command to start the application:
```bash
npm start
```

### Accessing the App
The server will start on two ports:
- **HTTP**: `http://localhost:3000` (Use this for desktop testing)
- **HTTPS**: `https://localhost:3443` (Use this if testing on a mobile device on the same Wi-Fi network. *Note: You will need to click "Advanced" -> "Proceed" to bypass the self-signed certificate warning.*)

To test the matchmaking locally, simply open two browser tabs to `http://localhost:3000` and click "Start Talking" in both tabs!

## Keyboard Shortcuts ⌨️
- `M`: Toggle microphone mute/unmute during a call.
- `Escape`: Cancel searching or end an active call.

## Deployment 🌍
This app requires a host that supports WebSockets and Node.js. It is highly recommended to deploy this app for free on [Render](https://render.com/).

1. Push this code to a GitHub repository.
2. Sign into Render and create a new **Web Service**.
3. Connect your repository.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Deploy!
