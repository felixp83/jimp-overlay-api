const express = require('express');
const Jimp = require('jimp');

const app = express();
app.use(express.json());

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

    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    // Maximale Textbreite und -höhe (z.B. 80% Breite, 30% Höhe des Bildes)
    const maxTextWidth = imageWidth * 0.8;
    const maxTextHeight = imageHeight * 0.3;

    // Schriftgrößen, die wir testen (von groß nach klein)
    const fonts = [
      Jimp.FONT_SANS_128_BLACK,
      Jimp.FONT_SANS_64_BLACK,
      Jimp.FONT_SANS_32_BLACK,
      Jimp.FONT_SANS_16_BLACK,
    ];

    // Dynamische Schriftartwahl - finde größte Schrift, die Text in max Höhe und Breite passt
    let chosenFont = null;
    let textHeight = 0;

    for (const fontPath of fonts) {
      const font = await Jimp.loadFont(fontPath);
      const height = Jimp.measureTextHeight(font, overlay, maxTextWidth);

      if (height <= maxTextHeight) {
        chosenFont = font;
        textHeight = height;
        break; // passende Schriftgröße gefunden
      }
    }

    // Falls keine passende Schrift gefunden (Text zu lang), nehme kleinste Schrift
    if (!chosenFont) {
      chosenFont = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      textHeight = Jimp.measureTextHeight(chosenFont, overlay, maxTextWidth);
    }

    const padding = 20;

    // Positionierung: horizontal zentriert, vertikal unten mit Abstand
    const rectWidth = maxTextWidth + padding * 2;
    const rectHeight = textHeight + padding * 2;

    const rectX = (imageWidth - rectWidth) / 2;
    const rectY = imageHeight - rectHeight - 20; // 20 px Abstand unten

    // Weißer halbtransparenter Hintergrund
    const rectangleColor = Jimp.rgbaToInt(255, 255, 255, 180);

    // Rechteck zeichnen
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

    // Bild zurückgeben
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
