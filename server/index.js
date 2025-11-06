import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const DATA_PATH = path.resolve('./server/data/locations.json');

async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeData(data) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/locations', async (req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read locations' });
  }
});

app.post('/api/locations', async (req, res) => {
  try {
    const loc = req.body;
    if (!loc || !loc.id || !loc.name) {
      return res.status(400).json({ error: 'Invalid location payload' });
    }
    const data = await readData();
    if (data.find((d) => d.id === loc.id)) {
      return res.status(409).json({ error: 'Location with this id already exists' });
    }
    data.push(loc);
    await writeData(data);
    res.status(201).json(loc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

app.put('/api/locations/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body;
    const data = await readData();
    const idx = data.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data[idx] = { ...data[idx], ...update };
    await writeData(data);
    res.json(data[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = await readData();
    const newData = data.filter((d) => d.id !== id);
    if (newData.length === data.length) return res.status(404).json({ error: 'Not found' });
    await writeData(newData);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
