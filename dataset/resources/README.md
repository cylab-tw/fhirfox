# 原始資料

此目錄包含 FHIRfox 測試情境與轉換流程共用的原始資料，以及欄位定義。

## 目錄結構

- `/dataset/resources/<resource-type>/*.json`
  - 各 resource type 的原始資料
- `/dataset/resources/definitions/*.yaml`
  - 各 resource type 的欄位定義

## 原始資料 JSON

- 同一類型資料通常集中在同一個子目錄
- 各筆資料以 `id` 作為穩定識別值
- 情境重用既有資料時，優先以 code、category、gender、ageGroup、class、status 等自然 scenario filter 命中；不要新增 pool/config。
- 只有自然條件無法穩定表達情境時，才使用 resource 自身的 `id`。
- 只有當情境 filter 能完全且只命中預期 resource 時，才重用既有 resource file。
- 若重用會讓 filter 變得過寬、依賴偶然的 patient/encounter overlap，或多帶出不屬於情境的資料，應保留或新增獨立 resource file。
- `xxxId` 欄位通常用來對應其他 resource 的 `id`
- 若同一個 `xxxId` 可能指向多種 resource type，可另外提供 `xxxType` 來消除歧義

## 欄位定義

`definitions/*.yaml` 用來說明：

- 某個欄位是否適用於該 resource
- 欄位卡度
- 哪些欄位為必要欄位
- 某個 reference 欄位對應的 resource type
- linked resource 推導使用的 reference 關聯

只要欄位有 `reference` 設定，dataset layer 就會自動把它視為 link 定義。

例如：

```yaml
observation:
  performerId:
    reference:
      - patient
      - practitioner
```

會自動推導成一條 `observation.performerId -> patient|practitioner` 的 link。

## 驗證

`dataset:check` 會檢查：

- 未知欄位
- 必填欄位缺漏
- reference 指到不存在的 resource
- reference 型別與 `xxxType` 不一致
- 同一個 reference 值命中多個 resource type 時的歧義 warning
- 需要 mapping 的 code 缺少對應列

```bash
# 在 /generator 下執行
npm run dataset:check
```
