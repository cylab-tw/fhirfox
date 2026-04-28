# FHIRfox Validator 使用說明

## 目錄內容

| 檔案／資料夾 | 說明 |
|------|------|
| `fhirfox-validator.exe` / `fhirfox-validator` | 執行檔 |
| `examples/` | 範例 Bundle（可直接用來試跑） |

---

## 第一步：下載題目答案

首次使用前必須執行，將答案從伺服器下載到本機：

```
fhirfox-validator update
```

執行後會在同目錄下自動建立 `answer-keys/` 資料夾。

---

## 指令說明

### validate — 驗證 Bundle

```
fhirfox-validator validate <bundle檔案> <情境ID>
```

讀取 FHIR Bundle JSON，與標準答案比對後輸出差異與分數。結果同時顯示於 console，並自動儲存為 `YYYYMMDD-HHmmss-log.txt`。

**範例：**
```
fhirfox-validator validate my-bundle.json TWCORE-OPD-001
```

**輸出格式：**
```
=== TWCORE-OPD-001: 一般門診（成人） ===

  Patient/1
    [✗] Patient.gender  expected: male  actual: female
    [✗] Patient.birthDate  expected: 1985-04-12  actual: (missing)

  Observation/1
    (all fields match)

Score: 21 / 23 required fields passed (91%)

Log saved: C:\...\20260428-143022-log.txt
```

| 標記 | 意義 |
|------|------|
| `(all fields match)` | 該資源所有欄位與答案一致 |
| `[✗]` | 欄位值不符，顯示期望值與實際值 |
| `actual: (missing)` | 欄位不存在 |
| `[MISSING ENTRY]` | 整個資源不存在於 Bundle 中 |

Score 只計算標記為必填的欄位，每個資源實例個別計算。

---

### list — 查看可用情境

```
fhirfox-validator list
```

列出本機已下載的所有情境 ID 與名稱。

---

### update — 更新答案

```
fhirfox-validator update
```

從伺服器下載最新答案，覆蓋本機的 `answer-keys/`。

---

### show-template — 查看標準答案

```
fhirfox-validator show-template <情境ID>
```

將指定情境的標準 FHIR Bundle 輸出為 JSON，可作為撰寫參考。

```
fhirfox-validator show-template TWCORE-OPD-001 > template.json
```

---

## 使用範例檔案

`examples/` 內附的範例檔案皆對應 `TWCORE-OPD-001` 情境，可直接試跑：

```
fhirfox-validator validate examples/test-c1-bundle.json TWCORE-OPD-001
```

---

## macOS / Linux

請先賦予執行權限：

**macOS：**
```
chmod +x fhirfox-validator-macos
./fhirfox-validator-macos update
./fhirfox-validator-macos validate examples/test-c1-bundle.json TWCORE-OPD-001
```

**Linux：**
```
chmod +x fhirfox-validator-linux
./fhirfox-validator-linux update
./fhirfox-validator-linux validate examples/test-c1-bundle.json TWCORE-OPD-001
```
