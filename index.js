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

    const image = await Jimp.read(url);
    const imageWidth = image.bitmap.width;
    const imageHeight = image.bitmap.height;

    const maxTextWidth = imageWidth * 0.8;
    const maxTextHeight = imageHeight * 0.3;

    const fontCandidates = [
      { size: 64, path: Jimp.FONT_SANS_64_BLACK },
      { size: 32, path: Jimp.FONT_SANS_32_BLACK },
      { size: 16, path: Jimp.FONT_SANS_16_BLACK },
    ];

    const overlayText = overlay.toUpperCase();

    async function textFits(fontPath, text, maxWidth, maxHeight) {
      const font = await Jimp.loadFont(fontPath);
      const height = Jimp.measureTextHeight(font, text, maxWidth);
      return height <= maxHeight;
    }

    let chosenFont = null;
    for (const candidate of fontCandidates) {
      if (await textFits(candidate.path, overlayText, maxTextWidth, maxTextHeight)) {
        chosenFont = await Jimp.loadFont(candidate.path);
        break;
      }
    }
    if (!chosenFont) {
      chosenFont = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    }

    const textHeight = Jimp.measureTextHeight(chosenFont, overlayText, maxTextWidth);
    const padding = 20;
    const rectWidth = maxTextWidth + padding * 2;
    const rectHeight = textHeight + padding * 2;

    const rectX = (imageWidth - rectWidth) / 2;
    const rectY = imageHeight - rectHeight - 20;

    const rectXInt = Math.round(rectX);
    const rectYInt = Math.round(rectY);
    const rectWidthInt = Math.round(rectWidth);
    const rectHeightInt = Math.round(rectHeight);

    // 🔹 HALBTRANSPARENTER HINTERGRUND: #add8e6 mit alpha 150
    image.scan(rectXInt, rectYInt, rectWidthInt, rectHeightInt, (x, y, idx) => {
      image.bitmap.data[idx + 0] = 173; // R
      image.bitmap.data[idx + 1] = 216; // G
      image.bitmap.data[idx + 2] = 230; // B
      image.bitmap.data[idx + 3] = 150; // A
    });

    const textImage = new Jimp(rectWidthInt, rectHeightInt, 0x00000000);

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
