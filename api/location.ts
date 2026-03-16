import axios from "axios";

export default async function handler(req: any, res: any) {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : (req.socket?.remoteAddress || req.ip || '');
    
    console.log(`[Location Service] Client IP identified: ${clientIp}`);

    try {
        // Try ipapi.co with Client IP
        try {
            const url = clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' 
                ? `https://ipapi.co/${clientIp}/json/` 
                : 'https://ipapi.co/json/';
                
            const resp = await axios.get(url, { 
                timeout: 5000,
                headers: { 'User-Agent': 'node.js' }
            });
            if (resp.data && resp.data.city) {
                const loc = resp.data.region ? `${resp.data.city}, ${resp.data.region}` : resp.data.city;
                return res.json({ location: loc, source: 'ipapi.co', ip: clientIp });
            }
        } catch (e: any) {
            console.warn(`[Location Service] ipapi.co failed: ${e.message}`);
        }

        // Fallback to ip-api.com with Client IP
        const url2 = clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1'
            ? `http://ip-api.com/json/${clientIp}`
            : 'http://ip-api.com/json/';

        const resp2 = await axios.get(url2, { timeout: 5000 });
        if (resp2.data && resp2.data.city) {
            const loc = resp2.data.regionName ? `${resp2.data.city}, ${resp2.data.regionName}` : resp2.data.city;
            return res.json({ location: loc, source: 'ip-api.com', ip: clientIp });
        }
        
        res.status(404).json({ error: "Location could not be determined from IP.", ip: clientIp });
    } catch (err: any) {
        console.error("Standalone IP location fetch failed:", err);
        res.status(500).json({ 
            error: "Failed to fetch location via IP",
            details: err.message || "Unknown error"
        });
    }
}
