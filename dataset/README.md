# 資料集

此目錄包含 FHIRfox 的原始資料、情境分級中繼資料，以及 HIS → FHIR 轉換所使用的規則與對照表。

## 目錄結構

- `resources/`
  - 各 resource type 的原始資料 JSON
  - `definitions/*.yaml`
- `scenarios/`
  - `levels.json`
- `converter/`
  - `generator-rules/*.csv`
  - `code-mappings/*.csv`
  - `resource-profiles.csv`

## 資料說明

- `resources/` 提供情境挑選、linked resource 展開與轉換流程使用的來源資料
- `resources/definitions/*.yaml` 說明各類原始資料可用欄位、卡度、必要欄位與 `reference` 目標型別；dataset authoring layer 會從這些 `reference` 設定自動推導 links
- `scenarios/levels.json` 定義 UI 與資料集展示使用的情境等級標題與說明
- `converter/generator-rules/*.csv` 定義原始欄位如何轉成 FHIR path，以及哪些欄位需要 code mapping
- `converter/code-mappings/*.csv` 定義本地代碼如何對應到標準代碼系統
- `converter/resource-profiles.csv` 定義各 resource 對應的 FHIR profile

## 驗證

請在 `/generator` 目錄下執行：

```bash
npm run dataset:check
```

`dataset:check` 會回報 error 與 warning；若有 error 會以非零狀態碼結束。

若需要較完整的 warning 報告：

```bash
npm run dataset:doctor
```

`dataset:doctor` 會額外輸出 summary，方便快速檢視目前資料品質狀態。

## 參考

- [測試情境](../scenarios/README.md)
- [原始資料](./resources/README.md)
- [轉換規則與對照表](./converter/README.md)
