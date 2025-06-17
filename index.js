const express = require('express');
const Jimp = require('jimp');
const path = require('path');

const app = express();
app.use(express.json());

// Statischer Server für den public-Ordner (für gespeicherte Bilder)
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Hello, this is the Jimp Overlay API!');
});

app.post('/overlay', async (req, res) => {
  try {
    const { url, overlay, row_id } = req.body;
    if (!url || !overlay) {
      return res.status(400).json({ error: 'url und overlay sind Pflicht' });
    }

    // Bild laden
    const image = await Jimp.read(url);

    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    const maxTextWidth = imageWidth * 0.8;
    const maxTextHeight = imageHeight * 0.3;

    const fonts = [
      Jimp.FONT_SANS_128_BLACK,
      Jimp.FONT_SANS_64_BLACK,
      Jimp.FONT_SANS_32_BLACK,
      Jimp.FONT_SANS_16_BLACK,
    ];

    let chosenFont = null;
    let textHeight = 0;

    for (const fontPath of fonts) {
      const font = await Jimp.loadFont(fontPath);
      const height = Jimp.measureTextHeight(font, overlay, maxTextWidth);

      if (height <= maxTextHeight) {
        chosenFont = font;
        textHeight = height;
        break;
      }
    }

    if (!chosenFont) {
      chosenFont = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      textHeight = Jimp.measureTextHeight(chosenFont, overlay, maxTextWidth);
    }

    const padding = 20;

    const rectWidth = maxTextWidth + padding * 2;
    const rectHeight = textHeight + padding * 2;

    const rectX = (imageWidth - rectWidth) / 2;
    const rectY = imageHeight - rectHeight - 20;

    // Weißer halbtransparenter Hintergrund
    image.scan(rectX, rectY, rectWidth, rectHeight, (x, y, idx) => {
      image.bitmap.data[idx + 0] = 255; // R
      image.bitmap.data[idx + 1] = 255; // G
      image.bitmap.data[idx + 2] = 255; // B
      image.bitmap.data[idx + 3] = 180; // Alpha halbtransparent
    });

    // Text zentriert drucken
    image.print(
      chosenFont,
      rectX + padding,
      rectY + padding,
      {
        text: overlay,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      maxTextWidth
    );

    // Ursprünglichen Dateinamen aus URL extrahieren
    const urlParts = url.split('/');
    const originalFilename = urlParts[urlParts.length - 1];
    const dotIndex = originalFilename.lastIndexOf('.');
    const name = dotIndex !== -1 ? originalFilename.substring(0, dotIndex) : originalFilename;
    const ext = '.png'; // Wir speichern immer als PNG

    // Millisekunden seit Mitternacht berechnen
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const msSinceMidnight = now - midnight;

    // Neuen Dateinamen erstellen
    const filename = `${name}-${msSinceMidnight}${ext}`;
    const savePath = path.join(__dirname, 'public', filename);

    await image.writeAsync(savePath);

    // URL zum gespeicherten Bild (angepasst an deine Domain / Host)
    const imageUrl = `${req.protocol}://${req.get('host')}/public/${filename}`;

    // Antwort mit Bild-URL und row_id
    res.json({ imageUrl, row_id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Bildes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
