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
    const { url, overlay } = req.body;
    if (!url || !overlay) {
      return res.status(400).json({ error: 'url und overlay sind Pflicht' });
    }

    // Bild laden
    let image;
    try {
      image = await Jimp.read(url);
    } catch (err) {
      return res.status(400).json({ error: 'Bild konnte nicht geladen werden', details: err.message });
    }

    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    // Max Text-Bereich berechnen
    const maxTextWidth = imageWidth * 0.8;
    const maxTextHeight = imageHeight * 0.3;

    // Schriftgröße: Wir nehmen Jimp.FONT_SANS_128_BLACK und vergrößern Text 10%
    const baseFont = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);

    // Text in Großbuchstaben umwandeln
    const overlayText = overlay.toUpperCase();

    // Texthöhe messen mit baseFont
    const textHeight = Jimp.measureTextHeight(baseFont, overlayText, maxTextWidth);

    // Padding
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

    // Hintergrundfarbe hellblau mit Alpha
    const bgColor = { r: 167, g: 199, b: 231, a: 180 };

    // Funktion für Alpha-Wert zur Erzeugung abgerundeter Ecken ohne "Pfeile"
    function alphaForPixel(x, y) {
      const dx = Math.min(x, rectWidthInt - 1 - x);
      const dy = Math.min(y, rectHeightInt - 1 - y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dx >= cornerRadius && dy >= cornerRadius) {
        return bgColor.a;
      }
      if (dist < cornerRadius - 1) {
        return bgColor.a;
      }
      if (dist > cornerRadius + 1) {
        return 0;
      }
      // sanfter Übergang für Anti-Aliasing
      return bgColor.a * (1 - (dist - (cornerRadius - 1)) / 2);
    }

    // Overlay-Box mit abgerundeten Ecken
    const overlayBox = new Jimp(rectWidthInt, rectHeightInt, 0x00000000);

    overlayBox.scan(0, 0, rectWidthInt, rectHeightInt, (x, y, idx) => {
      const alpha = alphaForPixel(x, y);
      if (alpha > 0) {
        overlayBox.bitmap.data[idx + 0] = bgColor.r;
        overlayBox.bitmap.data[idx + 1] = bgColor.g;
        overlayBox.bitmap.data[idx + 2] = bgColor.b;
        overlayBox.bitmap.data[idx + 3] = Math.round(alpha);
      } else {
        overlayBox.bitmap.data[idx + 3] = 0;
      }
    });

    image.composite(overlayBox, rectXInt, rectYInt);

    // Textfarbe dunkelgrau #333333
    // Jimp hat keine direkte Möglichkeit, Farbcode im Font zu setzen.
    // Wir nutzen Font Schwarz und färben den Text nachträglich um.

    // Text als separate Bildfläche rendern (ohne Hintergrund)
    const textImage = new Jimp(rectWidthInt, rectHeightInt, 0x00000000);

    textImage.print(
      baseFont,
      padding,
      padding,
      {
        text: overlayText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      maxTextWidth
    );

    // Textfarbe von schwarz auf dunkelgrau #333333 ändern
    textImage.scan(0, 0, textImage.bitmap.width, textImage.bitmap.height, (x, y, idx) => {
      const r = textImage.bitmap.data[idx + 0];
      const g = textImage.bitmap.data[idx + 1];
      const b = textImage.bitmap.data[idx + 2];
      const a = textImage.bitmap.data[idx + 3];
      // Nur schwarze Pixel (R=G=B=0, Alpha > 0) einfärben
      if (r === 0 && g === 0 && b === 0 && a > 0) {
        textImage.bitmap.data[idx + 0] = 51;  // R
        textImage.bitmap.data[idx + 1] = 51;  // G
        textImage.bitmap.data[idx + 2] = 51;  // B
        // Alpha unverändert lassen
      }
    });

    // Textbild auf das Hauptbild legen
    image.composite(textImage, rectXInt, rectYInt);

    // Datei speichern
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
