# FHIRfox 技術手冊

本文件為 FHIRfox 專案的技術參考，涵蓋專案架構、開發環境設定、建置流程與部署方式。

## 專案結構

```
FHIRfox/
├── database/                    # HIS 模擬資料庫定義
│   ├── schema.sql               # 資料庫 Schema（generator_rule、resource_profile、code_mapping）
│   ├── code_mapping.seed.sql    # 代碼對應 Seed Data
│   └── igs/                     # FHIR IG 資料
├── dataset/                     # 來源資料集
│   ├── resources/               # 各資源類型的來源資料
│   ├── converter/               # HIS → FHIR 轉換規則
│   │   ├── generator-rules/     # 欄位對應規則（CSV）
│   │   └── code-mappings/       # 代碼對應（CSV）
│   └── scenarios/               # 情境後設資料
├── scenarios/                   # 測試情境定義（YAML）
├── generator/                   # TypeScript Monorepo（npm workspaces）
│   ├── package.json             # Workspace 根設定
│   ├── patches/                 # 第三方套件 Patch（patch-package）
│   ├── converter/               # @fhirfox/converter — HIS→FHIR 轉換引擎
│   ├── dataset/                 # @fhirfox/dataset — 資料集管理與驗證
│   └── frontend/                # @fhirfox/frontend — 情境瀏覽器 Web UI
```

## 開發環境

### 前置需求

- **Node.js** v24 以上（專案透過 `.nvmrc` 指定 v24.14.0）
- **npm** v10 以上

### 安裝

```bash
cd generator
npm install
```

> `postinstall` 會自動執行 `patch-package`，套用對第三方套件的修正。

### 建置

```bash
# 建置所有套件（依序：dataset → converter → frontend）
npm run build

# 僅建置特定套件
npm run build --workspace converter
npm run build --workspace dataset
npm run build --workspace frontend
```

### 開發伺服器

```bash
# 先建置 converter 和 dataset（frontend 依賴這兩者）
npm run build --workspace converter --workspace dataset

# 啟動前端開發伺服器
npm run dev --workspace frontend
```

開發伺服器啟動後，Vite 會在本機提供情境瀏覽器，並在 `dataset/` 和 `scenarios/` 變更時自動重載。

## 部署

### 手動建置靜態檔案

```bash
cd generator
npm run build --workspace converter --workspace dataset
FHIRFOX_BASE_PATH=/fhirfox/ npm run build --workspace frontend
```

產出的靜態檔案位於 `generator/frontend/dist/`。

## Patch 說明

專案使用 `patch-package` 修正 `@uiw/react-json-view` 的渲染問題：

- **問題：** 該套件使用 `useEffect` 註冊自訂 render 函數，導致首次渲染會短暫顯示預設樣式（閃爍）
- **修正：** 將 `useEffect` 替換為 `useLayoutEffect`，確保自訂 render 在瀏覽器繪製前生效
- **Patch 檔案：** `generator/patches/@uiw+react-json-view+2.0.0-alpha.41.patch`

> 升級 `@uiw/react-json-view` 版本時需重新檢視此 patch 是否仍適用。
