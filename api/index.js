import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO;
const FILE_PATH = process.env.GITHUB_FILE_PATH;
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

const githubHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json'
};

async function getCurrentFile() {
    try {
        const res = await axios.get(API_URL, { headers: githubHeaders });
        return {
            content: Buffer.from(res.data.content, 'base64').toString('utf8'),
            sha: res.data.sha
        };
    } catch (err) {
        throw new Error('Gagal mengambil data dari GitHub');
    }
}

async function updateFile(content, sha, commitMessage) {
    const updatedContent = Buffer.from(content, 'utf8').toString('base64');
    const payload = {
        message: commitMessage,
        content: updatedContent,
        sha: sha,
        branch: 'main'
    };
    const res = await axios.put(API_URL, payload, { headers: githubHeaders });
    return res.data;
}

// GET semua anime
app.get('/api/anime', async (req, res) => {
    try {
        const { content } = await getCurrentFile();
        res.json(JSON.parse(content));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET anime by ID
app.get('/api/anime/:id', async (req, res) => {
    try {
        const { content } = await getCurrentFile();
        const animeList = JSON.parse(content);
        const anime = animeList.find(a => a.id === req.params.id);
        if (!anime) return res.status(404).json({ error: 'Anime tidak ditemukan' });
        res.json(anime);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST tambah anime
app.post('/api/anime', async (req, res) => {
    try {
        const newAnime = req.body;
        
        const requiredFields = ['title', 'cover', 'synopsis', 'genre', 'studio', 'rating', 'views', 'latestEpisode', 'uploadDate', 'episodes'];
        for (const field of requiredFields) {
            if (!newAnime[field] || (typeof newAnime[field] === 'string' && newAnime[field].trim() === '')) {
                return res.status(400).json({ error: `Field '${field}' wajib diisi` });
            }
        }
        
        // Hapus scheduleDay & scheduleStatus jika kosong
        if (!newAnime.scheduleDay || newAnime.scheduleDay === '') delete newAnime.scheduleDay;
        if (!newAnime.scheduleStatus || newAnime.scheduleStatus === '') delete newAnime.scheduleStatus;
        
        // Default isTrending = false jika tidak ada
        if (newAnime.isTrending === undefined) newAnime.isTrending = false;
        
        const { content, sha } = await getCurrentFile();
        let animeList = JSON.parse(content);
        
        const maxId = Math.max(...animeList.map(a => parseInt(a.id)), 0);
        newAnime.id = (maxId + 1).toString();
        
        animeList.push(newAnime);
        await updateFile(JSON.stringify(animeList, null, 2), sha, `Add anime: ${newAnime.title}`);
        
        res.json({ success: true, id: newAnime.id, message: 'Anime berhasil ditambahkan' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT edit anime
app.put('/api/anime/:id', async (req, res) => {
    try {
        const animeId = req.params.id;
        let updatedAnime = req.body;
        
        const requiredFields = ['title', 'cover', 'synopsis', 'genre', 'studio', 'rating', 'views', 'latestEpisode', 'uploadDate', 'episodes'];
        for (const field of requiredFields) {
            if (!updatedAnime[field] || (typeof updatedAnime[field] === 'string' && updatedAnime[field].trim() === '')) {
                return res.status(400).json({ error: `Field '${field}' wajib diisi` });
            }
        }
        
        if (!updatedAnime.scheduleDay || updatedAnime.scheduleDay === '') delete updatedAnime.scheduleDay;
        if (!updatedAnime.scheduleStatus || updatedAnime.scheduleStatus === '') delete updatedAnime.scheduleStatus;
        if (updatedAnime.isTrending === undefined) updatedAnime.isTrending = false;
        
        const { content, sha } = await getCurrentFile();
        let animeList = JSON.parse(content);
        
        const index = animeList.findIndex(a => a.id === animeId);
        if (index === -1) return res.status(404).json({ error: 'Anime tidak ditemukan' });
        
        updatedAnime.id = animeId;
        animeList[index] = updatedAnime;
        
        await updateFile(JSON.stringify(animeList, null, 2), sha, `Edit anime: ${updatedAnime.title}`);
        res.json({ success: true, message: 'Anime berhasil diupdate' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE anime
app.delete('/api/anime/:id', async (req, res) => {
    try {
        const animeId = req.params.id;
        const { content, sha } = await getCurrentFile();
        let animeList = JSON.parse(content);
        
        const deletedAnime = animeList.find(a => a.id === animeId);
        if (!deletedAnime) return res.status(404).json({ error: 'Anime tidak ditemukan' });
        
        const newAnimeList = animeList.filter(a => a.id !== animeId);
        await updateFile(JSON.stringify(newAnimeList, null, 2), sha, `Delete anime: ${deletedAnime.title}`);
        res.json({ success: true, message: 'Anime berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

export default app;
