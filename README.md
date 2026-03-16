# Site Supervisor 📸 🤖

Site Supervisor is a real-time, AI-powered assistant designed to help hosts and property managers inspect, manage, and design their short-term rental properties. Utilizing the **Gemini Live (Multimodal Bidi) API**, you can simply point your camera at a room, talk to it like an expert interior designer, and receive instant, actionable feedback. 

Our application also features a **Real-Time Generative Decor & Shopping Integration** that visually overlays modern decor ideas and provides real, clickable Google Shopping links directly onto your camera feed!

## Features 🚀

- **Real-Time Video & Audio Analysis:** Streams low-latency WebRTC video and audio to Gemini via WebSockets.
- **Expert Interior Design Mode:** Gemini is configured to provide direct spatial layout advice, color palette suggestions, and hospitality standards.
- **Generative Decor Moodboards:** Ask Gemini to "generate some decor ideas" and the app will natively intercept a tool call to overlay a smart moodboard matching your desired style.
- **Dynamic Shopping Links:** The AI intelligently generates highly specific product search terms, which the backend translates into real Google Shopping searches.
- **Interruptible AI:** Stop the AI mid-sentence by pressing the Stop/Hand button to change directions instantly.

## Repository Structure 🛠️

This project is separated into a Node.js backend to securely handle the Gemini API connection, and a Vite React frontend.

- `/backend/`: Express and `ws` WebSocket server. Translates client streams to Gemini Live API protocol and handles function calling securely.
- `/frontend/`: React + Vite application capturing MediaRecorder streams, performing local VAD (Voice Activity Detection), and displaying visual overlays.

---

## Spin-Up Guide (Local Development) 💻

To run Site Supervisor locally, you need to spin up both the backend and frontend servers.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A valid [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 2. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory and add your API Key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   PORT=8080
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *(The backend runs on `http://localhost:8080`)*

### 3. Frontend Setup

1. Open a **new** terminal window/tab and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *(The frontend typically runs on `http://localhost:5173`)*

### 4. Using the App

1. Open your browser and navigate to `http://localhost:5173`.
2. Ensure you grant **Camera and Microphone permissions**.
3. Tap the **Mic Icon** at the bottom to connect to the Gemini AI.
4. Once the status shows "Listening...", start talking! Point your camera at a room and ask for design feedback.
5. Try saying: *"What kind of furniture would look good in this space? Can you generate a moodboard?"* to reveal the generative shopping UI!

---

## Troubleshooting

- **1008 Policy Violation Error:** This usually means the API key is invalid or the chosen model is not supported for Bidi streaming on your account. The backend is configured to use the currently supported `gemini-2.5-flash-native-audio-latest` on the `v1beta` endpoint.
- **Address Already in Use:** If port `8080` or `5173` is occupied, kill the existing process (e.g., `kill -9 $(lsof -t -i:8080)` on macOS/Linux).
- **Audio/Video not working:** Check browser permissions and ensure you are accessing the site via `localhost` or `https` (browsers block MediaRecorder API on insecure HTTP IPs).

## Deployment

Refer to the [deployment guide](./deployment_guide.md) (if generated) or check `/backend/Dockerfile` for Cloud Run containerization instructions.
