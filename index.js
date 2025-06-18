const express = require('express');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Absoluter Pfad zum public-Ordner relativ zum Arbeitsverzeichnis
const publicDir = path.resolve('./public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// Statischer Server für gespeicherte Bilder
app.use('/public', express.static(publicDir));

app.get('/', (req, res) => {
  res.send('Hello, this is the Jimp Overlay API!');
});

app.post('/overlay', async (req, res) => {
  try {
    const { url, overlay } = req.body;
    if (!url || !overlay) {
      return res.status(400).json({ error: 'url und overlay sind Pflicht' });
    }

    const image = await Jimp.read(url);

    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    const maxTextWidth = imageWidth * 0.8;
    const maxTextHeight = imageHeight * 0.3;

    // Vergrößerte Fonts
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

    // 📌 Rosa Hintergrund mit abgerundeten Ecken (simuliert durch Alpha-Gradient)
    const background = await new Jimp(rectWidth, rectHeight, 0xFFC0CBB4); // Rosa + Alpha
    background.roundCorners(6); // Abrundung (6 px)
    image.composite(background, rectX, rectY);

    // Text auf rosa Fläche
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

    // Ursprünglichen Dateinamen extrahieren
    const urlParts = url.split('/');
    const originalFilename = urlParts[urlParts.length - 1];
    const dotIndex = originalFilename.lastIndexOf('.');
    const name = dotIndex !== -1 ? originalFilename.substring(0, dotIndex) : originalFilename;
    const ext = '.png';

    // Zeitstempel für Dateinamen
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const msSinceMidnight = now - midnight;

    const filename = `${name}-${msSinceMidnight}${ext}`;
    const savePath = path.join(publicDir, filename);

    console.log('📁 Bild speichern unter:', savePath);
    await image.writeAsync(savePath);

    const imageUrl = `${req.protocol}://${req.get('host')}/public/${filename}`;
    res.json({ imageUrl });

  } catch (error) {
    console.error('❌ Fehler beim Verarbeiten:', error);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Bildes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
