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

    // Schriftarten laden (größere Schrift, weiß für Schatten und dunkelgrau für Text)
    const shadowFont = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);  // Schatten: Schwarz, groß
    const textFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);    // Text: Weiß (wir färben ihn später um)

    // Position für Text
    const x = 20;
    const y = 20;

    // Schatten: leicht versetzt (z.B. 2px rechts, 2px unten)
    image.print(shadowFont, x + 2, y + 2, overlay);

    // Text drüber drucken
    image.print(textFont, x, y, overlay);

    // Jetzt das Bild mit dem weißen Text dunkler machen (dunkelgrau) - 
    // weil Jimp die Schriftart nicht direkt einfärbt, färben wir den Bereich mit dem Text nachträglich um
    // (Alternativ: hier als Workaround nutzen wir blendMode OVERLAY mit Grau)

    // Finde die Breite und Höhe des Textes, damit wir nur den Textbereich färben können
    const textWidth = Jimp.measureText(textFont, overlay);
    const textHeight = Jimp.measureTextHeight(textFont, overlay, image.bitmap.width);

    // Erstelle eine dunkle graue Farbe (RGB 50, 50, 50)
    const darkGray = Jimp.rgbaToInt(50, 50, 50, 255);

    // Übermale die weiße Schrift mit dunkelgrau — so sieht der Text dunkelgrau aus
    image.scan(x, y, textWidth, textHeight, (px, py, idx) => {
      // Nur weiße Pixel färben wir um
      const red = image.bitmap.data[idx + 0];
      const green = image.bitmap.data[idx + 1];
      const blue = image.bitmap.data[idx + 2];
      const alpha = image.bitmap.data[idx + 3];

      // Weißer Text ist (255,255,255) ungefähr
      if (red > 240 && green > 240 && blue > 240 && alpha > 0) {
        image.bitmap.data[idx + 0] = 50; // R
        image.bitmap.data[idx + 1] = 50; // G
        image.bitmap.data[idx + 2] = 50; // B
      }
    });

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
