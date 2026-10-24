# 新竹風城島

以互動城市呈現使用者提供的施政整理：12 個主題、90 項原文紀錄。原創 Three.js 城市模型，提供主題選取、全文搜尋、狀態篩選、詳細資料、鳥瞰、日照及動畫控制。新增可自訂角色、28位城市人物、10條示意協作線、搬運徽章、步道行走、鏡頭跟隨、拍照定點及城市日誌；手機使用底部清單，WebGL 不可用時仍能閱讀全部內容。

## 本機執行

```sh
npm ci
npm run dev
```

開啟終端顯示的本機網址。正式靜態輸出使用 `npm run build`，結果在 `dist/`；可用 `npm run preview` 檢查。

## 驗證

```sh
npm test
npx playwright test
npm run build
```

Playwright 預設使用 macOS 已安裝的 Google Chrome；其他平台可設定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`，或 `npx playwright install chromium` 後使用 Playwright Chromium。

## 資料

- `src/data.json`：12 類 90 項；標題及敘述保留來源原文。
- `docs/施政成果整理.md`：使用者提供的原檔。
- `docs/content-notes.md`：分類方式、疑義、日期適用範圍。
- `docs/architecture.md`：城市場景、角色、路徑與介面模組說明。

`reported` 是「資料所列成果」，不是獨立核實或全部完成。`pending` 對應原文第十二類的 8 項。第 3、22、84、86 項有來源敘述待核對提示。沒有新增已查證的政策關係、官方來源、地理座標或成果數字；10條角色路線明確標示為視覺示意。

城市是主題示意，不是新竹地理或建物現況模型。外部字型使用 Google Fonts，載入失敗時使用系統字型。沒有後端或追蹤碼；角色外觀與自訂姓名只保存在目前瀏覽器的 localStorage，不上傳。

## 分支

`develop` 為開發整合分支。功能分支從 `develop` 建立，完成後以 PR 合併回 `develop`。

## GitHub Pages

網站：https://smallmouth.github.io/kao-hsinchu-island/

合併到 `main` 後，GitHub Actions 會安裝依賴、執行單元測試及建置，再將 `dist/` 部署至 GitHub Pages。建置時從 Pages 設定取得 base path，確保專案子路徑下的資源正常載入。`develop` 與功能分支不會部署。
