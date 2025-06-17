const express = require('express');
const Jimp = require('jimp');

const app = express();
app.use(express.json());

// Startseite: GET /
app.get('/', (req, res) => {
  res.send('Hello, this is the Jimp Overlay API!');
});

app.post('/overlay', async (req, res) => {
  try {
    const { url, overlay } = req.body;
    if (!url || !overlay) {
      return res.status(400).json({ error: 'url und overlay sind Pflicht' });
    }

    // Bild laden
    const image = await Jimp.read(url);

    // Schrift laden (Schriftart von Jimp)
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_GREY);

    // Overlay-Text oben links (du kannst x,y ändern)
    image.print(font, 50, 50, overlay);

    // Bild als Buffer zurückschicken (png)
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

    res.set('Content-Type', 'image/png');
    res.send(buffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Bildes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
