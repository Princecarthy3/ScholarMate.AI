export default async function handler(req, res) {
    // Allow requests from all origins (Vercel, GitHub Pages, Localhost)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle browser preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { message, apiKey: reqApiKey } = req.body || {};
        
        // CENTRALIZED BACKEND GEMINI API KEY
        const CENTRALIZED_GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6If5Rk5prL6tSIyvZYFM2_8CkbfLOFsDdK2Nvzl5zgs3A';

        const apiKey = CENTRALIZED_GEMINI_API_KEY || reqApiKey || '';

        if (!apiKey) {
            return res.status(400).json({ error: "Centralized Backend Gemini API Key is missing." });
        }

        console.log("Received message:", message ? message.slice(0, 100) : "empty");

        const models = [
            'gemini-3.6-flash',
            'gemini-3.5-flash-lite',
            'gemini-2.5-flash'
        ];

        let lastData = null;
        let lastStatus = 500;

        for (const model of models) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
                    }
                );

                const data = await response.json();
                if (response.ok) {
                    return res.status(200).json(data);
                }
                lastData = data;
                lastStatus = response.status;
            } catch (err) {
                console.warn(`Model ${model} fetch failed:`, err.message);
            }
        }

        return res.status(lastStatus).json(lastData || { error: "AI Generation unavailable. Please check your API key." });

    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            error: error.message
        });
    }
}
