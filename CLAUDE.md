# CLAUDE.md — chiefrom-report 開發守則

本 repo（torikuo314/chiefrom-report）是 **Public**。每次開發都必須遵守：

1. **客人資料絕對不能進 GitHub。** 客人姓名、手機、任何神美匯出檔（.xlsx／.xls／.csv／.numbers），一律只存在私人 Google 試算表。不要把這類檔案放進專案資料夾，也不要 commit。
2. **開發與測試只能用假資料。** 需要測試資料時，用 `tests/fake-shenmei.js` 自己產生假的神美訂單列表；不要向使用者索取真實檔案。
3. 後端 `Code.gs`／`Care.gs` 留在 Google Apps Script，**不要放進 repo**（獎金算法與權限邏輯不能公開）。本機若有副本，只能放在已被 `.gitignore` 排除的 `gas/` 資料夾。
4. 所有權限檢查都在後端執行；前端只負責畫面。後端網址是公開的，每個 API 都要驗證 session token 與角色。
5. 前端不得把客人資料寫進 `console.log`、`localStorage`、URL 參數。
6. commit 前執行 `git status`，確認沒有任何 xlsx／csv 或真實資料。
