# 桌面寵物

用 Electron 製作的 macOS 桌面寵物 App。寵物會在桌面上走來走去，可以互動、坐下、趴下、叫牠過來，也可以上傳自己的去背 PNG 做成新的桌面寶貝。

## 主要功能

- 透明、置頂的桌面寵物視窗
- macOS 選單列寵物圖示，可叫出控制面板
- 控制面板可調整名字、互動顏色、大小、速度
- 動作包含：叫牠、坐下、趴下
- 點一下寵物會互動，趴下時再點一下會開始走
- 連點兩下寵物會坐下
- 拖曳寵物到定點後放開，寵物會趴下並固定在那裡
- 坐下提醒計時器，可自訂提醒時間和提醒詞
- 可上傳自己的已去背 PNG：坐下、3-5 張走路、趴下
- 可恢復原始寵物設定

## 需求

- macOS
- Node.js
- npm

確認 npm 可用：

```bash
npm --version
```

## 安裝

```bash
npm install
```

## 執行桌面版

```bash
npm run desktop
```

啟動後，寵物會出現在桌面上。點 macOS 右上角選單列的寵物圖示，可以開啟控制面板。

## 上傳自己的寵物

在控制面板的「自家寶貝」區塊上傳：

- `坐下`：1 張已去背 PNG
- `走路`：3-5 張已去背 PNG
- `趴下`：1 張已去背 PNG

注意：

- 只接受 PNG。
- 請先自行去背，程式不會自動去背。
- 成功上傳後會顯示已上傳幾個檔案。
- 按「製作新寵物」後會直接取代目前桌面上的寵物。
- 按「恢復原始設定」可以回到預設寵物。

## 瀏覽器預覽

開發時可以用瀏覽器預覽部分畫面：

```bash
npm start
```

打開：

```text
http://127.0.0.1:4173
```

這個預覽伺服器只綁定 `127.0.0.1`，只允許本機連線。

## 打包 macOS App

產生圖示：

```bash
npm run icons
```

打包：

```bash
npm run dist:mac
```

輸出檔案會在 `dist/`。

如果只要 Apple Silicon 版本，可以執行：

```bash
npm run dist:mac:arm64
```

目前預設是 ad-hoc 簽章，沒有 Apple Developer ID notarization。下載者第一次開啟時，可能需要在 Finder 對 App 右鍵選「打開」。

## 安全性設計

- 正式 app 不會開啟 port。
- 開發預覽 server 只綁定 `127.0.0.1`。
- Electron 關閉 `nodeIntegration`。
- Electron 開啟 `contextIsolation` 與 `sandbox`。
- 頁面使用 Content Security Policy，禁止外部連線。
- 禁止視窗任意跳轉和開新視窗。
- 權限請求預設拒絕。
- 打包後會移除 camera、microphone、Bluetooth 權限描述。
- 打包後會移除 `NSAllowsArbitraryLoads`，只保留 localhost / 127.0.0.1 本機例外。

## 專案結構

```text
assets/                 預設寵物素材
build/                  App 與選單列圖示
docs/                   使用教學
electron/               Electron main/preload 程式
scripts/                圖示產生與打包後處理腳本
src/pet-window.js       桌面寵物行為
src/pet-window.css      桌面寵物樣式
src/toolbar.js          控制面板行為
src/toolbar.css         控制面板樣式
pet.html                桌面寵物視窗
toolbar.html            控制面板視窗
server.js               本機開發預覽 server
package.json            npm scripts 與 electron-builder 設定
```

## 不要上傳到 GitHub 的內容

`.gitignore` 已排除：

- `node_modules/`
- `dist/`
- `.cache/`
- `.DS_Store`
- 編輯器暫存檔

## 授權

公開發布前建議選擇一個授權條款，例如 MIT License。
