import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const HOST = process.env.HOST || '0.0.0.0';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const SYSTEM_INSTRUCTION = "You are an expert interior designer and practical property manager. You are looking through the user's camera feed to help them set up and inspect a short-term rental property. Provide concise, direct, and actionable advice. Focus on spatial layout, color palettes (especially incorporating modern earthy tones), hospitality standards, and identifying maintenance issues. If the user interrupts you, stop talking immediately and respond to their new direction.";

wss.on('connection', async (ws: WebSocket) => {
    console.log('Client connected to local WebSocket.');
    let latestFrameData: string | null = null;

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
    const geminiWs = new WebSocket(url);

    geminiWs.on('open', () => {
        console.log("Connected to Gemini Live API");

        // Initial setup payload required by Live API
        const setupPayload = {
            setup: {
                model: 'models/gemini-2.5-flash-native-audio-latest', // Officially supported bidi model
                systemInstruction: {
                    parts: [{ text: SYSTEM_INSTRUCTION }]
                },
                tools: [
                    {
                        functionDeclarations: [
                            {
                                name: "generate_decor_ideas",
                                description: "Generate a visual moodboard and shopping links based on the user's room and described preferences.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        stylePrompts: {
                                            type: "STRING",
                                            description: "A summary of the style the user wants (e.g., 'modern bohemian with earthy tones')"
                                        },
                                        products: {
                                            type: "ARRAY",
                                            description: "A list of 3 specific product suggestions that fit the style.",
                                            items: {
                                                type: "OBJECT",
                                                properties: {
                                                    title: { type: "STRING", description: "A catchy title for the product, e.g., 'Mid-Century Velvet Sofa'" },
                                                    searchQuery: { type: "STRING", description: "A highly specific search query for the product to be used in a shopping engine, e.g., 'mid century green velvet 3 seater sofa'" },
                                                    estimatedPrice: { type: "STRING", description: "An estimated price or price range, e.g., '$500 - $800'" }
                                                },
                                                required: ["title", "searchQuery", "estimatedPrice"]
                                            }
                                        }
                                    },
                                    required: ["stylePrompts", "products"]
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseModalities: ["AUDIO"]
                }
            }
        };
        geminiWs.send(JSON.stringify(setupPayload));
    });

    geminiWs.on('message', (data: any) => {
        try {
            const response = JSON.parse(data.toString());
            // Gemini sends serverContent in bidi API
            if (response.serverContent && response.serverContent.modelTurn) {
                const parts = response.serverContent.modelTurn.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(audioBuffer);
                        }
                    }
                }
            }
            if (response.serverContent && response.serverContent.interrupted) {
                console.log("AI generation interrupted.");
            }
            if (response.toolCall) {
                const functionCalls = response.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                    const call = functionCalls[0];
                    if (call.name === 'generate_decor_ideas') {
                        const args = call.args as any;
                        console.log("Gemini called generate_decor_ideas", args);
                        
                        // Parse products from Gemini or use fallbacks if undefined
                        const products = args.products || [
                            { title: "Mid-Century Modern Sofa", searchQuery: "mid century modern sofa", estimatedPrice: "$899" },
                            { title: "Abstract Geometric Rug", searchQuery: "abstract geometric area rug", estimatedPrice: "$150" },
                            { title: "Minimalist Floor Lamp", searchQuery: "minimalist brass floor lamp", estimatedPrice: "$120" }
                        ];

                        // Construct real Google Shopping search links
                        const links = products.map((p: any) => ({
                            title: p.title || "Decor Item",
                            price: p.estimatedPrice || "Check Price",
                            url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(p.searchQuery)}`
                        }));

                        // 1. Send the visual overlay payload to the frontend
                        ws.send(JSON.stringify({
                            type: 'visual_generation',
                            data: {
                                image: 'https://images.unsplash.com/photo-1598928506311-c55dd1b7d5a5?q=80&w=1470&auto=format&fit=crop', // Mock AI generated image
                                links: links
                            }
                        }));

                        // 2. Respond to Gemini so it knows the tool execution succeeded
                        geminiWs.send(JSON.stringify({
                            toolResponse: {
                                functionResponses: [
                                    {
                                        id: call.id,
                                        response: {
                                            result: "Successfully showed moodboard and shopping links to the user."
                                        }
                                    }
                                ]
                            }
                        }));
                    }
                }
            }
        } catch (e) {
            console.error("Error parsing Gemini response", e);
        }
    });

    geminiWs.on('close', (code, reason) => {
        console.log(`Gemini Live API connection closed. Code: ${code}, Reason: ${reason}`);
        ws.close();
    });

    geminiWs.on('error', (err) => {
        console.error("Gemini Error: ", err);
    });

    ws.on('message', (message: any, isBinary: boolean) => {
        if (geminiWs.readyState !== WebSocket.OPEN) return;

        if (isBinary) {
            const base64Audio = message.toString('base64');
            const payload = {
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64Audio
                    }]
                }
            };
            geminiWs.send(JSON.stringify(payload));
        } else {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'video') {
                    const base64Data = data.frame.split(',')[1] || data.frame;
                    latestFrameData = base64Data;
                    geminiWs.send(JSON.stringify({
                        realtimeInput: {
                            mediaChunks: [{
                                mimeType: 'image/jpeg',
                                data: base64Data
                            }]
                        }
                    }));
                } else if (data.type === 'client.interrupt') {
                    console.log("User interrupted -> Sending interruption signal to Gemini.");
                    geminiWs.send(JSON.stringify({
                        clientContent: {
                            turnComplete: true,
                            turns: [{ role: "user", parts: [] }]
                        }
                    }));
                } else if (data.type === 'text') {
                    geminiWs.send(JSON.stringify({
                        clientContent: {
                            turnComplete: true,
                            turns: [{ role: "user", parts: [{ text: data.text }] }]
                        }
                    }));
                }
            } catch (e) {
                console.error("Invalid JSON from client: ", e);
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
});
