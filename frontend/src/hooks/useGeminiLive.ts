import { useState, useRef, useCallback } from 'react';

const AUDIO_RATE = 16000;
const VAD_THRESHOLD = 0.05; // Heuristic Volume Threshold for interruption
const WS_URL = import.meta.env.VITE_WS_URL;
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY || 'default-secret-key';

export function useGeminiLive() {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking'>('idle');
    const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
    const [generationData, setGenerationData] = useState<{ image: string; links: { title: string, url: string, price: string }[] } | null>(null);
    
    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const nextPlayTimeRef = useRef<number>(0);
    const isPlayingRef = useRef(false);
    const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);

    const connect = useCallback(async () => {
        setStatus('connecting');
        try {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_RATE });
            await audioCtxRef.current.audioWorklet.addModule('/audio-processor.js');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: { facingMode: cameraMode, width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;

            // Setup Video
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
            }

            // Setup WebSocket
            wsRef.current = new WebSocket(`${WS_URL}?token=${CLIENT_API_KEY}`);
            wsRef.current.binaryType = 'arraybuffer';

            wsRef.current.onopen = () => {
                setConnected(true);
                setStatus('listening');

                // Start Audio Capture
                const source = audioCtxRef.current!.createMediaStreamSource(stream);
                const workletNode = new AudioWorkletNode(audioCtxRef.current!, 'audio-recorder-worklet');

                workletNode.port.onmessage = (e) => {
                    const data = e.data;
                    
                    if (data && data instanceof ArrayBuffer) {
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                             wsRef.current.send(data);
                        }
                        
                        // Simple VAD based on Int16 data for interruption
                        // Calculate RMS of the buffer
                        const pcm = new Int16Array(data);
                        let sumSqures = 0;
                        for(let i=0; i<pcm.length; i++) {
                             // Normalize back to roughly -1 to 1 for RMS
                             const floatVal = pcm[i] / 32768.0;
                             sumSqures += floatVal * floatVal;
                        }
                        const rms = Math.sqrt(sumSqures / pcm.length);
                        
                        // If user is talking and AI is currently speaking, interrupt it
                        if (rms > VAD_THRESHOLD && isPlayingRef.current) {
                             interruptAI();
                        }
                    }
                };
                source.connect(workletNode);
                workletNode.connect(audioCtxRef.current!.destination);

                // Start Video Capture Loop
                const interval = setInterval(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN && videoRef.current && canvasRef.current) {
                        const video = videoRef.current;
                        const canvas = canvasRef.current;
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx && canvas.width > 0) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            // quality 0.5 to reduce bandwidth
                            const base64Frame = canvas.toDataURL('image/jpeg', 0.5); 
                            wsRef.current.send(JSON.stringify({ type: 'video', frame: base64Frame }));
                        }
                    }
                }, 1000); // 1 FPS

                //@ts-ignore
                wsRef.current._videoInterval = interval;
            };

            wsRef.current.onmessage = async (e) => {
                if (e.data instanceof ArrayBuffer) {
                    setStatus('speaking');
                    // It's binary audio data from Gemini
                    await playAudioChunk(e.data);
                } else {
                    // It's a string, meaning custom JSON from backend
                    try {
                        const json = JSON.parse(e.data);
                        if (json.type === 'visual_generation') {
                            setGenerationData(json.data);
                        }
                    } catch (err) {
                        console.error('Failed parsing ws message', err);
                    }
                }
            };

            wsRef.current.onclose = () => {
                setConnected(false);
                setStatus('idle');
                disconnect();
            };

        } catch (err) {
            console.error("Connection failed", err);
            setStatus('idle');
        }
    }, [cameraMode]);

    const playAudioChunk = async (arrayBuffer: ArrayBuffer) => {
        if (!audioCtxRef.current) return;
        
        try {
            // Context needs to decode raw PCM? Gemini returns raw PCM for BidiStream?
            // Actually, usually Gemini SDK returns BidiStream `inlineData.data` as raw audio?
            // Wait, Gemini Live API audio might be PCM 16-bit 24kHz or something. We can decode it using decodeAudioData IF it has a WAV header, OR we just manually create a buffer. 
            // The Live API `generateContentStream` natively returns PCM 24kHz. Let's assume PCM 16-bit 24kHz.
            // Let's create an AudioBuffer from PCM.
            const pcm16 = new Int16Array(arrayBuffer);
            const audioBuffer = audioCtxRef.current.createBuffer(1, pcm16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for(let i = 0; i < pcm16.length; i++){
                channelData[i] = pcm16[i] / 32768.0;
            }

            const source = audioCtxRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtxRef.current.destination);
            
            sourceNodesRef.current.push(source);

            const currentTime = audioCtxRef.current.currentTime;
            const playTime = Math.max(currentTime, nextPlayTimeRef.current);
            
            source.start(playTime);
            nextPlayTimeRef.current = playTime + audioBuffer.duration;
            isPlayingRef.current = true;

            source.onended = () => {
                sourceNodesRef.current = sourceNodesRef.current.filter(s => s !== source);
                if (sourceNodesRef.current.length === 0) {
                     isPlayingRef.current = false;
                     setStatus('listening');
                }
            };

        } catch (e) {
             console.error("Error playing audio chunk", e);
        }
    };

    const interruptAI = () => {
        console.log("Interrupting AI");
        // Flush queue
        sourceNodesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        sourceNodesRef.current = [];
        isPlayingRef.current = false;
        
        if (audioCtxRef.current) {
             nextPlayTimeRef.current = audioCtxRef.current.currentTime;
        }

        // Notify backend
        if (wsRef.current?.readyState === WebSocket.OPEN) {
             wsRef.current.send(JSON.stringify({ type: 'client.interrupt' }));
        }
        setStatus('listening');
    };

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            //@ts-ignore
            clearInterval(wsRef.current._videoInterval);
            wsRef.current.close();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
        }
        interruptAI();
        setConnected(false);
        setStatus('idle');
    }, []);

    const toggleCamera = () => {
        setCameraMode(prev => prev === 'environment' ? 'user' : 'environment');
        // If currently connected, we should restart the connection to apply new camera
        if (connected) {
            disconnect();
            setTimeout(connect, 500);
        }
    };

    return {
        connected,
        status,
        cameraMode,
        videoRef,
        generationData,
        connect,
        disconnect,
        toggleCamera,
        interruptAI,
        clearGeneration: () => setGenerationData(null)
    };
}
