export default async function handler(req, res) {
‏    // CORS للسماح لأي بوت
‏    res.setHeader('Access-Control-Allow-Origin', '*');
‏    res.setHeader('Access-Control-Allow-Methods', 'GET');
‏
‏    const query = req.query.query;
‏    const limit = parseInt(req.query.limit) || 30;
‏
‏    if (!query) {
‏        return res.status(400).json({ error: 'query required' });
‏    }
‏
‏    try {
‏        const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
‏        const response = await fetch(url, {
‏            headers: {
‏                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
‏                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
‏                'accept-language': 'en-US,en;q=0.9',
‏            },
‏        });
‏
‏        const html = (await response.text())
‏            .replace(/\\u002F/gi, '/')
‏            .replace(/\\\//g, '/')
‏            .replace(/\\u0026/gi, '&');
‏
‏        const re = /https:\/\/i\.pinimg\.com\/(originals|236x|474x|564x|736x)\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f_]+\.(?:jpg|jpeg|png|gif|webp))/gi;
‏        const images = [];
‏        const seen = new Set();
‏        let m;
‏        while ((m = re.exec(html)) !== null) {
‏            if (seen.has(m[2])) continue;
‏            seen.add(m[2]);
‏            images.push(`https://i.pinimg.com/736x/${m[2]}`);
‏            if (images.length >= limit) break;
‏        }
‏
‏        res.status(200).json({
‏            images,
‏            count: images.length,
‏            query,
‏        });
‏    } catch (e) {
‏        res.status(500).json({ error: e.message });
‏    }
‏}