# GitHub 上傳與發布檢查清單

## 第一次上傳 Repo

1. 在 GitHub 建立新的 repository。
2. 在這個專案資料夾執行：

```bash
git init
git add .
git commit -m "Initial desktop pet app"
git branch -M main
git remote add origin <你的 GitHub repo URL>
git push -u origin main
```

## 確認不要上傳的檔案

`.gitignore` 已經排除：

- `node_modules/`
- `dist/`
- `.cache/`
- `.DS_Store`
- 編輯器暫存檔

## 如果要提供下載檔

打包：

```bash
npm run icons
npm run dist:mac:arm64
```

到 GitHub 的 Releases 建立新版本，並上傳：

- `dist/桌面寵物-0.1.0-arm64.dmg`：Apple Silicon Mac
- `dist/桌面寵物-0.1.0-arm64-mac.zip`：Apple Silicon Mac 備用

目前沒有提供 Intel Mac 版本。如果要支援 Intel Mac，需要另外打包 x64 或 universal 版本並測試。

## macOS 安全性提醒

目前 App 是 ad-hoc 簽章，尚未 notarize。下載者第一次開啟時可能需要：

1. 在 Finder 找到「桌面寵物.app」
2. 右鍵點選「打開」
3. 再按一次「打開」

如果未來要讓使用者雙擊就能正常開啟，需要 Apple Developer ID 簽章與 notarization。
