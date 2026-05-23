const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { app, BrowserWindow } = require("electron");

const root = path.join(__dirname, "..");
const buildDir = path.join(root, "build");
const iconsetDir = path.join(buildDir, "icon.iconset");
const sourcePng = path.join(buildDir, "icon-1024.png");
const trayPng = path.join(buildDir, "tray-dog.png");
const icnsPath = path.join(buildDir, "icon.icns");
const trayHtmlPath = path.join(buildDir, "tray-icon.html");

const iconSizes = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  await app.whenReady();
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    webPreferences: {
      offscreen: true
    }
  });

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html, body {
            width: 1024px;
            height: 1024px;
            margin: 0;
            background: transparent;
            overflow: hidden;
          }
          .icon {
            width: 1024px;
            height: 1024px;
            display: grid;
            place-items: center;
            background:
              radial-gradient(circle at 32% 24%, rgba(255,255,255,0.95), rgba(255,255,255,0.14) 31%, transparent 32%),
              linear-gradient(145deg, #fff8ec 0%, #f8d39b 48%, #cf8751 100%);
            border-radius: 236px;
            box-shadow:
              inset 0 0 0 26px rgba(255,255,255,0.48),
              inset 0 -48px 90px rgba(70,37,18,0.22);
          }
          .emoji {
            margin-top: 18px;
            font-family: "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
            font-size: 610px;
            line-height: 1;
            filter: drop-shadow(0 32px 30px rgba(65, 35, 12, 0.24));
          }
        </style>
      </head>
      <body>
        <div class="icon"><div class="emoji">🐶</div></div>
      </body>
    </html>
  `;

  fs.writeFileSync(trayHtmlPath, html);
  await win.loadFile(trayHtmlPath);
  const image = await win.capturePage();
  fs.writeFileSync(sourcePng, image.toPNG());

  for (const [name, size] of iconSizes) {
    execFileSync("sips", ["-z", String(size), String(size), sourcePng, "--out", path.join(iconsetDir, name)], {
      stdio: "inherit"
    });
  }

  await renderTrayIcon(win);
  win.destroy();
  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", icnsPath], { stdio: "inherit" });
  app.quit();
}

async function renderTrayIcon(win) {
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html, body {
            width: 88px;
            height: 88px;
            margin: 0;
            background: transparent;
            overflow: hidden;
          }
          body {
            display: grid;
            place-items: center;
          }
          .emoji {
            width: 88px;
            height: 88px;
            display: grid;
            place-items: center;
            font-family: "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
            font-size: 66px;
            line-height: 1;
          }
        </style>
      </head>
      <body><div class="emoji">🐶</div></body>
    </html>
  `;

  fs.writeFileSync(trayHtmlPath, html);
  win.setContentSize(88, 88);
  await win.loadFile(trayHtmlPath);
  const image = await win.capturePage();
  fs.writeFileSync(trayPng, image.toPNG());
}

main().catch((error) => {
  console.error(error);
  app.quit();
  process.exit(1);
});
