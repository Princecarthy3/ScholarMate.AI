export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { message, inlineData } = req.body || {};
        const apiKey = process.env.OPENROUTER_API_KEY || '';

        if (!apiKey) {
            return res.status(500).json({
                error: "OPENROUTER_API_KEY is missing. Add it to your Vercel Environment Variables."
            });
        }

        const userContent = [
            {
                type: "text",
                text: message || "Analyze the attached image and explain the concepts shown."
            }
        ];

        if (inlineData?.data) {
            const mimeType = inlineData.mimeType || "image/jpeg";
            userContent.push({
                type: "image_url",
                image_url: {
                    url: `data:${mimeType};base64,${inlineData.data}`
                }
            });
        }

        const models = [
            process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free',
            process.env.OPENROUTER_FALLBACK_MODEL || 'google/gemma-4-26b-a4b-it:free',
            'openrouter/free'
        ];

        let lastData = null;
        let lastStatus = 503;

        for (const model of models) {
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': req.headers.referer || 'https://scholarmate.ai',
                        'X-Title': 'ScholarMate AI'
                    },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content: userContent }],
                        temperature: 0.4,
                        max_tokens: 4096
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (response.ok) return res.status(200).json(data);

                lastData = data;
                lastStatus = response.status;
                console.warn(`OpenRouter model ${model} failed:`, data?.error || response.statusText);
            } catch (err) {
                console.warn(`OpenRouter model ${model} request failed:`, err.message);
            }
        }

        return res.status(lastStatus).json(
            lastData || { error: "AI generation unavailable. Please try again shortly." }
        );
    } catch (error) {
        console.error("OpenRouter error:", error);
        return res.status(500).json({ error: error.message });
    }
}
