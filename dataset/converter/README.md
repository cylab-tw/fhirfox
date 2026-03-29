# 轉換規則與對照表

此目錄包含 HIS 原始資料轉為 FHIR 所使用的欄位規則、代碼對照表與 profile 設定。

## 目錄結構

- `/dataset/converter/generator-rules/*.csv`
  - 欄位轉換規則
- `/dataset/converter/code-mappings/*.csv`
  - 代碼對照表
- `/dataset/converter/resource-profiles.csv`
  - resource profile 設定

## 轉換規則

`generator-rules/*.csv` 用來描述：

- `resource_type`
- 原始欄位名稱
- 對應的 FHIR path
- 欄位型別
- transform kind
- 是否需要 code mapping

若某列有 `mapping_key`，表示該欄位需要對應 `code-mappings/` 內的同名 CSV 檔。

例如：

- `mapping_key = administrative-gender`
  - 對應 `administrative-gender.csv`
- `mapping_key = condition-ver-status`
  - 對應 `condition-ver-status.csv`

## 代碼對照表

`code-mappings/*.csv` 每列通常包含：

- `source_code`
- `target_code`
- `target_display`
- `target_system`
- `display_zh_tw`
- `is_active`

若某個 mapping 檔存在，但沒有任何 generator rule 或 source field contract 參照到它，`dataset:check` / `dataset:doctor` 會回報 `mapping.orphanRow` warning。

## 驗證

```bash
# 在 /generator 下執行
npm run dataset:check
```

若看到：

```text
WARN [mapping.orphanRow] ...
```

表示該 mapping key 目前沒有被任何 generator rule 或 source field contract 使用。
