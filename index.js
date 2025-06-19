const express = require('express');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const app = express();
const port = 3000;

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

app.use('/public', express.static(publicDir));
app.use(express.json());

app.post('/overlay', async (req, res) => {
  try {
    let { url, overlay } = req.body;
    if (!url || !overlay) {
      return res.status(400).json({ error: 'url und overlay sind Pflicht' });
    }

    // Overlay in Großbuchstaben umwandeln
    overlay = overlay.toUpperCase();

    let image;
    try {
      image = await Jimp.read(url);
    } catch (err) {
      return res.status(400).json({ error: 'Bild konnte nicht geladen werden', details: err.message });
    }

    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    const maxTextWidth = imageWidth * 0.88; // ca. 10% größer als vorher (0.8 -> 0.88)
    const maxTextHeight = imageHeight * 0.3;

    // Größere Fonts priorisieren
    const fonts = [
      Jimp.FONT_SANS_128_BLACK,
      Jimp.FONT_SANS_64_BLACK,
      Jimp.FONT_SANS_32_BLACK,
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
      chosenFont = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
      textHeight = Jimp.measureTextHeight(chosenFont, overlay, maxTextWidth);
    }

    const padding = 30;
    const rectWidth = maxTextWidth + padding * 2;
    const rectHeight = textHeight + padding * 2;

    const rectX = (imageWidth - rectWidth) / 2;
    const rectY = imageHeight - rectHeight - 40;

    const rectXInt = Math.round(rectX);
    const rectYInt = Math.round(rectY);
    const rectWidthInt = Math.round(rectWidth);
    const rectHeightInt = Math.round(rectHeight);

    const cornerRadius = 25;

    // Hintergrund mit abgerundeten Ecken (weißer halbtransparenter Kasten)

    // Neue Methode: Wir erzeugen eine Maske für den runden Hintergrund
    const overlayBox = new Jimp(rectWidthInt, rectHeightInt, 0x00000000);

    // Fülle Rechteck mit weißer halbtransparenter Farbe
    overlayBox.scan(0, 0, rectWidthInt, rectHeightInt, (x, y, idx) => {
      const dx = Math.min(x, rectWidthInt - 1 - x);
      const dy = Math.min(y, rectHeightInt - 1 - y);
      const distSquared = dx * dx + dy * dy;

      if (dx >= cornerRadius || dy >= cornerRadius || distSquared <= cornerRadius * cornerRadius) {
        overlayBox.bitmap.data[idx + 0] = 255;
        overlayBox.bitmap.data[idx + 1] = 255;
        overlayBox.bitmap.data[idx + 2] = 255;
        overlayBox.bitmap.data[idx + 3] = 200; // Alpha halbtransparent
      } else {
        // außerhalb der Rundung transparent lassen (keine Pfeile)
        overlayBox.bitmap.data[idx + 3] = 0;
      }
    });

    image.composite(overlayBox, rectXInt, rectYInt);

    // Text in dunkelgrau (#333333) zeichnen
    // Da Jimp nur Schwarz/Weiß Fonts hat, müssen wir die Farbe nachträglich anpassen

    const textImage = new Jimp(rectWidthInt, rectHeightInt, 0x00000000);

    textImage.print(
      chosenFont,
      padding,
      padding,
      {
        text: overlay,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      maxTextWidth
    );

    // Farbkorrektur: Schwarz (0,0,0) zu Dunkelgrau (#333333)
    textImage.scan(0, 0, textImage.bitmap.width, textImage.bitmap.height, (x, y, idx) => {
      const r = textImage.bitmap.data[idx + 0];
      const g = textImage.bitmap.data[idx + 1];
      const b = textImage.bitmap.data[idx + 2];

      if (r === 0 && g === 0 && b === 0) {
        textImage.bitmap.data[idx + 0] = 51;
        textImage.bitmap.data[idx + 1] = 51;
        textImage.bitmap.data[idx + 2] = 51;
      }
    });

    image.composite(textImage, rectXInt, rectYInt);

    // Bild speichern
    const urlParts = url.split('/');
    const originalFilename = urlParts[urlParts.length - 1];
    const dotIndex = originalFilename.lastIndexOf('.');
    const name = dotIndex !== -1 ? originalFilename.substring(0, dotIndex) : originalFilename;
    const ext = '.png';

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const msSinceMidnight = now - midnight;

    const filename = `${name}-${msSinceMidnight}${ext}`;
    const savePath = path.join(publicDir, filename);

    await image.writeAsync(savePath);

    const imageUrl = `${req.protocol}://${req.get('host')}/public/${filename}`;
    res.json({ imageUrl });

  } catch (error) {
    console.error('❌ Fehler beim Verarbeiten:', error);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Bildes', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Server läuft auf http://localhost:${port}`);
});
