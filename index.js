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

    const overlayText = overlay.toUpperCase();

    // 📥 Bild laden
    let original = await Jimp.read(url);

    // 📐 Zielverhältnis (Pinterest): 2:3
    const targetWidth = 1000;
    const targetHeight = 1500;
    const targetRatio = targetWidth / targetHeight;

    // 📏 Skaliere Bild so, dass möglichst wenig abgeschnitten wird
    const scaleW = targetWidth / original.bitmap.width;
    const scaleH = targetHeight / original.bitmap.height;
    const scale = Math.max(scaleW, scaleH); // so wenig wie möglich beschneiden

    const scaledWidth = Math.ceil(original.bitmap.width * scale);
    const scaledHeight = Math.ceil(original.bitmap.height * scale);

    let image = original.clone().resize(scaledWidth, scaledHeight);

    // 📐 Temporäres Cropping-Rechteck vorbereiten
    let cropX = Math.floor((scaledWidth - targetWidth) / 2);
    let cropY = Math.floor((scaledHeight - targetHeight) / 2);
    let cropW = targetWidth;
    let cropH = targetHeight;

    // ⬇️ Platz für Text reservieren (Höhe berechnen)
    const fontCandidates = [
      { size: 64, path: Jimp.FONT_SANS_64_BLACK },
      { size: 32, path: Jimp.FONT_SANS_32_BLACK },
      { size: 16, path: Jimp.FONT_SANS_16_BLACK }
    ];

    let chosenFont = null;
    let textHeight = 0;
    let padding = 20;
    const maxTextWidth = targetWidth * 0.8;

    for (const fontDef of fontCandidates) {
      const font = await Jimp.loadFont(fontDef.path);
      const h = Jimp.measureTextHeight(font, overlayText, maxTextWidth);
      if (h + padding * 2 < targetHeight * 0.3) {
        chosenFont = font;
        textHeight = h;
        break;
      }
    }

    if (!chosenFont) {
      chosenFont = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      textHeight = Jimp.measureTextHeight(chosenFont, overlayText, maxTextWidth);
    }

    const totalTextBlockHeight = textHeight + padding * 2;

    // 📐 Passe Crop-Y an, damit Text sichtbar bleibt
    if (cropY + cropH > scaledHeight - totalTextBlockHeight - 20) {
      cropY = Math.max(0, scaledHeight - cropH - totalTextBlockHeight - 20);
    }

    image = image.crop(cropX, cropY, cropW, cropH);

    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    const rectWidth = maxTextWidth + padding * 2;
    const rectHeight = textHeight + padding * 2;

    const rectX = Math.round((imageWidth - rectWidth) / 2);
    const rectY = Math.round(imageHeight - rectHeight - 20);

    const textImage = new Jimp(Math.round(rectWidth), Math.round(rectHeight), 0x00000000); // transparent

    textImage.print(
      chosenFont,
      padding,
      padding,
      {
        text: overlayText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      maxTextWidth
    );

    // Textfarbe: #333333 (schwarz → dunkelgrau)
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

    // Halbtransparenter Hintergrund unter Text (#add8e6 + alpha 150)
    image.scan(rectX, rectY, textImage.bitmap.width, textImage.bitmap.height, (x, y, idx) => {
      image.bitmap.data[idx + 0] = 173;
      image.bitmap.data[idx + 1] = 216;
      image.bitmap.data[idx + 2] = 230;
      image.bitmap.data[idx + 3] = 150;
    });

    image.composite(textImage, rectX, rectY);

    // 📤 Bild speichern
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
