const express = require('express');
const Jimp = require('jimp');

const app = express();
app.use(express.json());

app.post('/overlay', async (req, res) => {
  try {
    const { imageUrl, overlayText } = req.body;
    if (!imageUrl || !overlayText) {
      return res.status(400).json({ error: 'imageUrl und overlayText sind Pflicht' });
    }

    // Bild laden
    const image = await Jimp.read(imageUrl);

    // Schrift laden (Schriftart von Jimp)
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

    // Overlay-Text oben links (du kannst x,y ändern)
    image.print(font, 10, 10, overlayText);

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
