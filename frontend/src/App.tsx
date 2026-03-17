import { useGeminiLive } from './hooks/useGeminiLive';
import './index.css';

// SVG Icons
const MicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
);

const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
    </svg>
);

const CameraSwitchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

const HandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor">Stop</text>
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

function App() {
    const { 
        connected, 
        status, 
        videoRef, 
        generationData,
        connect, 
        disconnect, 
        toggleCamera, 
        interruptAI,
        clearGeneration
    } = useGeminiLive();

    const getStatusText = () => {
        switch (status) {
            case 'idle': return 'Ready to Connect';
            case 'connecting': return 'Connecting to AI...';
            case 'listening': return 'Listening...';
            case 'thinking': return 'Thinking...';
            case 'speaking': return 'AI Speaking...';
        }
    };

    return (
        <div className="app-container">
            <header className="header">
                <h1>Site Supervisor</h1>
            </header>

            <main className="video-container">
                {/* The main video feed, hidden when not connected but still capturing to canvas in logic */}
                <video 
                    ref={videoRef} 
                    className={`video-feed ${!connected ? 'hidden' : ''}`}
                    autoPlay 
                    playsInline 
                    muted 
                />
                
                {!connected && (
                    <div className="placeholder-view">
                        <MicIcon />
                        <p style={{ marginTop: '1rem' }}>Tap Mic to Start Inspection</p>
                    </div>
                )}

                <div className={`status-overlay status-${status}`}>
                    <div className="status-indicator"></div>
                    <span>{getStatusText()}</span>
                </div>

                {/* Moodboard Overlay */}
                <div className={`moodboard-overlay ${generationData ? 'visible' : ''}`}>
                    {generationData && (
                        <div className="moodboard-content">
                            <button className="moodboard-close" onClick={clearGeneration} aria-label="Close Moodboard">
                                <CloseIcon />
                            </button>
                            <div className="moodboard-shopping">
                                <h3>Shop The Look</h3>
                                <div className="product-list">
                                    {generationData.links.map((link, i) => (
                                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="product-card">
                                            <div className="product-info">
                                                <span className="product-title">{link.title}</span>
                                                <span className="product-price">{link.price}</span>
                                            </div>
                                            <div className="product-arrow">→</div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <footer className="controls-dock">
                <button 
                    className="btn" 
                    onClick={toggleCamera} 
                    disabled={!connected}
                    aria-label="Switch Camera"
                >
                    <CameraSwitchIcon />
                </button>

                <button 
                    className={`btn btn-primary ${connected ? 'active' : ''}`}
                    onClick={connected ? disconnect : connect}
                    aria-label={connected ? "Stop Session" : "Start Session"}
                >
                    {connected ? <StopIcon /> : <MicIcon />}
                </button>

                <button 
                    className="btn" 
                    onClick={interruptAI}
                    disabled={!connected || status !== 'speaking'}
                    aria-label="Interrupt AI"
                >
                    <HandIcon />
                </button>
            </footer>
        </div>
    );
}

export default App;
