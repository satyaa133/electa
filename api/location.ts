import axios from "axios";

export default async function handler(req: any, res: any) {
    try {
        // Try ipapi.co with User-Agent
        try {
            const resp = await axios.get('https://ipapi.co/json/', { 
                timeout: 5000,
                headers: { 'User-Agent': 'node.js' }
            });
            if (resp.data && resp.data.city) {
                const loc = resp.data.region ? `${resp.data.city}, ${resp.data.region}` : resp.data.city;
                return res.json({ location: loc });
            }
        } catch (e) {
            console.warn("ipapi.co failed, trying ip-api.com...");
        }

        // Fallback to ip-api.com
        const resp2 = await axios.get('http://ip-api.com/json/', { timeout: 5000 });
        if (resp2.data && resp2.data.city) {
            const loc = resp2.data.regionName ? `${resp2.data.city}, ${resp2.data.regionName}` : resp2.data.city;
            return res.json({ location: loc });
        }
        
        res.status(404).json({ error: "Location could not be determined from IP." });
    } catch (err: any) {
        console.error("Standalone IP location fetch failed:", err);
        res.status(500).json({ 
            error: "Failed to fetch location via IP",
            details: err.message || "Unknown error"
        });
    }
}
