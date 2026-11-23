const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

const UA = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
};

// ========== HEALTH CHECK ==========
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Pinterest + Rule34 API' });
});

app.get('/test', (req, res) => {
    res.json({ 
        status: 'server is working',
        timestamp: new Date().toISOString()
    });
});

// ========== PINTEREST API ==========
app.get('/api/pinterest', async (req, res) => {
    const query = req.query.query || req.query.q;
    const limit = parseInt(req.query.limit) || 30;

    if (!query) {
        return res.status(400).json({ error: 'query required' });
    }

    try {
        const pinUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
        
        const resp = await axios.get(pinUrl, {
            headers: UA,
            timeout: 20000,
            maxContentLength: 50 * 1024 * 1024
        });

        const html = resp.data
            .replace(/\\u002F/gi, '/')
            .replace(/\\\//g, '/')
            .replace(/\\u0026/gi, '&');

        const re = /https:\/\/i\.pinimg\.com\/(originals|236x|474x|564x|736x)\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f_]+\.(?:jpg|jpeg|png|gif|webp))/gi;
        const images = [];
        const seen = new Set();
        let m;
        
        while ((m = re.exec(html)) !== null && images.length < limit) {
            if (seen.has(m[2])) continue;
            seen.add(m[2]);
            images.push(`https://i.pinimg.com/736x/${m[2]}`);
        }

        if (images.length === 0) {
            return res.status(404).json({ 
                error: 'No images found',
                htmlLength: html.length
            });
        }

        res.json({ images, count: images.length, query });

    } catch (e) {
        res.status(500).json({ 
            error: e.message,
            status: e.response?.status || 'unknown'
        });
    }
});

// ========== RULE34 API ==========
app.get('/api/rule34', async (req, res) => {
    const tags = req.query.tags || req.query.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = parseInt(req.query.page) || 0;

    if (!tags) {
        return res.status(400).json({ error: 'tags required' });
    }

    const images = [];
    const seen = new Set();
    const usedSources = [];
    const push = (url) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        images.push(url);
    };

    // 1) Rule34
    try {
        const r34Url = `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(tags)}&pid=${page * 42}`;
        const r = await axios.get(r34Url, { headers: UA, timeout: 20000 });
        const html = r.data;
        const re = /https?:\/\/([a-z0-9.-]*rule34\.xxx)\/(?:thumbnails|images)\/(\d+)\/(thumbnail_)?([a-f0-9_]+\.(?:jpg|jpeg|png|gif))/gi;
        let m;
        while ((m = re.exec(html)) !== null && images.length < limit) {
            push(`https://${m[1]}/images/${m[2]}/${m[4]}`);
        }
        if (images.length) usedSources.push('rule34');
    } catch (e) {}

    // 2) Gelbooru
    if (images.length < limit) {
        try {
            const gbUrl = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=${limit}&pid=${page}&tags=${encodeURIComponent(tags)}`;
            const r = await axios.get(gbUrl, { headers: UA, timeout: 20000 });
            const list = Array.isArray(r.data) ? r.data : (r.data.post || []);
            for (const p of list) push(p.file_url || p.sample_url);
            if (list.length) usedSources.push('gelbooru');
        } catch (e) {}
    }

    // 3) Xbooru
    if (images.length < limit) {
        try {
            const xbUrl = `https://xbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=${limit}&pid=${page}&tags=${encodeURIComponent(tags)}`;
            const r = await axios.get(xbUrl, { headers: UA, timeout: 20000 });
            const list = Array.isArray(r.data) ? r.data : (r.data.post || []);
            for (const p of list) push(p.file_url || p.sample_url);
            if (list.length) usedSources.push('xbooru');
        } catch (e) {}
    }

    if (!images.length) {
        return res.status(404).json({ error: 'no results', tags });
    }

    res.json({
        images: images.slice(0, limit),
        count: Math.min(images.length, limit),
        tags,
        sources: usedSources,
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});