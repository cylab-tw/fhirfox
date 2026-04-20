# 測試情境

此目錄包含測試情境定義。每個情境使用一個 YAML 檔案，描述情境基本資料、篩選條件與 linked resources 展開方式。

欄位定義與 schema 位於 [schema.yaml](schema.yaml)。

## 檔案格式

每個情境使用一個 YAML 檔案，例如：

```yaml
id: TWCORE-OPD-001
name: 一般門診（成人）
level: 1
type: outpatient
summary: 成人一般門診情境。
details: |
  用來檢查門診資料是否完整。

selection:
  strategy: best-match
  maxSeeds: 1
  maxPatients: 1
  maxLinkedEncounters: 1
  expandLinks: true

condition:
  conditionCode: Cond-016
```

## 常用欄位

- `id`
- `name`
- `type`
- `level`
- `summary`
- `details`
- `selection`

resource filter 直接寫在對應 resource type 的頂層欄位下，例如：

- `patient`
- `encounter`
- `condition`
- `allergyIntolerance`
- `observation`
- `procedure`

## 欄位說明

### 情境基本欄位

| 欄位 | 型別 | 必填 | 說明                                              |
|---|---|---:|-------------------------------------------------|
| `id` | string | yes | 情境穩定識別碼，會用在 UI 與產生的資產路徑。                        |
| `name` | string | yes | 情境的正式顯示名稱。                                      |
| `type` | string | yes | 就醫流程類別，例如 `outpatient`、`emergency`、`inpatient`。 |
| `summary` | string | no | 短版摘要，適合一兩句話說明情境。                                |
| `details` | string | no | 長版敘述，支援 markdown 格式。                            |
| `level` | integer | no | 專案用來分層展示的測試情境分級。                                |
| `selection` | object | no | 控制如何挑選 direct matches 與是否展開 linked resources。   |

### selection

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---:|---|
| `strategy` | enum | no | `best-match` 或 `grouped-by-patient`。 |
| `maxSeeds` | integer | no | 最多保留幾個直接命中的資料。 |
| `maxPatients` | integer | no | 分組後最多保留幾位病人。 |
| `maxLinkedEncounters` | integer | no | 每個情境 scope 最多帶出幾個 linked encounter。 |
| `expandLinks` | boolean | no | 是否往外展開 linked resources。 |

### Resource filters

- 每個 resource section 都是「單一 filter object」或「filter object 陣列」。
- Scenario filter 是資源選取的唯一 authoring contract；不要另外建立 pool/config 來描述重用。
- 若情境要重用既有 resource，優先使用自然條件，例如 code、category、gender、ageGroup、class、status。
- 可用 `encounterId`、`patientId`、`medicationId` 等 relationship id 將自然條件綁定到同一次就醫或同一位病人。
- 只有在自然條件無法穩定表達情境時，才使用 resource 自身的 `id`。
- filter 必須完整且只命中該情境需要的 resource；不要用過寬條件依賴偶然的 patient/encounter overlap。
- `limit` 可加在任一 filter object 上，限制該 filter 最多保留幾筆 match。
- `schema.yaml` 主要描述整體結構與共用欄位型別。
- 各 resource filter 可用的詳細 key 由 `dataset:check` 驗證。

範例：

```yaml
observation:
  - observationCode: VS-0008
    encounterId: "1"
  - observationCode: Lab-0001
    encounterId: "4"
    limit: 1
```

Linked resource 展開會受情境 filter 約束：如果情境沒有定義 `observation` filter，就不會因為同一個 patient/encounter 自動帶出 observation。已選取臨床資料需要的 `patient`、`encounter`、`organization`、`medication`、`practitioner` 與 `practitionerRole` 仍會作為 dependency 帶出。

### 範圍條件欄位

- `patient.age`
- `encounter.stayDays`
- `encounter.count`

格式如下：

```yaml
age:
  gte: 18
  lt: 65
```

## 驗證

在 `/generator` 下可執行：

```bash
npm run dataset:check
```
