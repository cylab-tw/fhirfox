# FHIRfox

FHIRfox: Pre-generated synthetic clinical dataset simulating a HIS for FHIR transformation and testing
**模擬醫院資訊系統 (HIS)的合成式 FHIR 醫療資料集**

## 專案概述

FHIRfox提供**已預先生成 (pre-generated )之合成醫療資料**，模擬真實臨床流程，包含：

* 門診 (Outpatient)、急診 (Emergency)、住院 (Inpatient)
* 多科別就醫情境 (心臟科、小兒科、骨科等)
* 病人長期就醫歷程 (Longitudinal Records)
* 檢驗、診斷、用藥與影像等臨床資料

本專案主要用途包括：

* FHIR 實作與系統測試
* 醫療資訊互通性驗證 (HL7® FHIR®)
* HIS → FHIR資料轉換開發
* 聯測 (Connectathon)與測試環境建置

## 核心特色

* [x] 合成資料 (非真實病人資料，無需即時生成)
* [x] 模擬HIS關聯式資料庫結構
* [x] 多情境 (Scenario-based)設計
* [x] 支援多種FHIR IG (預設為TW Core，未來擴充IPS等FHIR IG)
* [x] 多格式輸出 (SQL/CSV/FHIR JSON)
* [x] 支援情境驅動測試 (Scenario-based Testing)

## 測試情境整體分層架構

* TW Core測試情境分成五個等級，採取「漸進式測試模型」，產生以「情境模式資料集 (Scenario-driven Dataset)」檢驗參測系統的TW Core FHIR化能力。
* 每個等級的資料採取累加設計，等級越高，則代表要處理的FHIR Resource越多，關聯的Resoure結構越複雜。

| 層級    | 名稱                                  | 補充                                                          |
| ------- | ------------------------------------- | ------------------------------------------------------------- |
| Level 1 | 基本就醫紀錄 (Core Patient Journey)   | 基本的就醫資訊                                                |
| Level 2 | 臨床處置與紀錄 (Clinical Basic)       | 病人就醫後進行的處置以及問診、觀察、與量測                    |
| Level 3 | 用藥與檢查 (Medication & Examination) | 醫師開立的藥物處方以及檢查 (影像、LAB)等措施                  |
| Level 4 | 診斷與檢驗整合 (Diagnostic Layer)     | 進一步的影像檢查、檢驗報告(套餐)、基因檢測等。**不在2026聯測範圍** |
| Level 5 | 跨院/慢性病/追蹤 (Complex Care)       | 病患為核心的歷次健康紀錄串聯。**不在2026聯測範圍**            |

### 測試情境 LEVEL 1: 基礎就醫紀錄

#### 概念說明 (LEVEL 1)

* Level 1為FHIRfox測試資料的最基本層級，目標是建立一組最小可用 (Minimum Viable)且符合臨床情境的就醫紀錄資料，用以模擬HIS中的就醫流程。本層級至少涵蓋以下FHIR Resource:
  * 臺灣核心-病人 (TW Core Patient): 提供病人基本資料
  * 臺灣核心-機構 (TW Core Organization): 就醫的醫事機構
  * 臺灣核心-就醫事件 (TW Core Encounter): 就醫事件(門診/急診/住院)
  * 臺灣核心-病情、問題或診斷 (TW Core Condition) Condition: 主訴與診斷
  * 臺灣核心-健康照護服務提供者 (TW Core Practitioner): 參與的醫事人員
  * 臺灣核心-健康照護服務提供者角色 (TW Core PractitionerRole): 參與的醫事人員與角色

### 測試目的 (LEVEL 1)

* 本層級測試情境設計的目為建立最小可用FHIR資料集，提供一組最基本但完整的臨床資料結構，使系統能夠:正確建立病人(Patient)且記錄就醫事件(Encounter)、並在就醫事件中紀錄病人以及醫事人員 (Practitioner、PractitionerRole)，例如: 掛號資訊。
* 此外，此測試情境提供驗證HIS轉換FHIR基本轉換能力，確保不同系統之間能正確交換最基本的醫療資訊，作為模擬傳統HIS資料轉換為FHIR Resource的最核心流程:
  * (1) 病人識別: 病人資料對應 (Patient mapping)
  * (2) 就醫事件追蹤: 就醫紀錄轉換 (Encounter mapping)

* 本層級應涵蓋以下基本就醫情境 (但不侷限):
  * **門診:** 一般看診
  * **急診:** 突發症狀
  * **住院:** 需留院治療

| 測試編號       | 名稱           | 補充 |
| -------------- | ---------------| ---- |
| TWCORE-OPD-001 | 一般門診(成人) |      |
| TWCORE-OPD-002 | 小兒門診       |      |
| TWCORE-OPD-003 | 同病人多次門診 |      |
| TWCORE-ER-001  | 急診           |      |
| TWCORE-IPD-001 | 住院           |      |

### 測試情境 LEVEL 2: 臨床處置與紀錄

#### 概念說明 (Level 2)

* Level 2在Level 1的基礎上，進一步加入臨床檢驗 (Observation)與醫療處置 (Procedure)，用以模擬門診、急診與住院中常見的醫療行為，使 FHIR 資料具備「臨床可讀性」與「數據化能力」，並能表達臨床問題 (Condition)，例如:過敏或不耐症 (AllergyIntolerance)。本層級特別強調檢驗資料的完整性與臨床關聯性，包含生命徵象與實驗室檢查，主要關注如下:
  -(1) 檢驗資料的結構化表達 (Observation)
  -(2) 臨床數據與就醫事件 (Encounter)的關聯
  -(3) 基本醫療行為 (Procedure)的紀錄
  -(4) 臨床問題轉換 (Condition mapping)
  -(5) 檢驗結果與診斷之間的臨床合理性

* 本層級應涵蓋以下基本就醫情境 (但不侷限):
  -**門診:** 一般看診 (如感冒、慢性病追蹤)，包含基本檢驗 (如體溫、血壓)
  -**急診:** 突發症狀 (如胸痛、外傷)，包含即時檢驗 (如血氧、心跳)
  -**住院:** 需留院治療 (如手術或觀察)，包含持續性檢驗(如每日生命徵象、實驗室數據)

### LEVEL 2 測試目的 (LEVEL 2)

* (1) **驗證臨床檢驗資料轉換能力:** 確保系統可將HIS檢驗資料正確轉換為FHIR Observation，例如:
  * **生命徵象:** 血壓(BP)、心跳 (HR)、體溫 (Temp)、呼吸速率 (RR)、血氧 (SpO2)
  * **實驗室檢驗:** 血液檢查 (BC、血糖)、尿液檢查 (Urinalysis)
* (2) **建立臨床資料與就醫情境的關聯:** 驗證Observation/Procedure是否能正確關聯:
* (3) **驗證基本醫療處置紀錄能力:** 模擬實際臨床流程，例如: 注射、傷口處理、以及基本醫療操作等
* (4) **測試資料結構與數值格式:** 確保系統能正確處理，例如: 數值型資料(valueQuantity)、單位(unit)、以及檢驗時間 (effectiveDateTime)等

* 本層級除了LEVEL 1包含的FHIR Resource以外，至少涵蓋以下FHIR Resource:
  * 臺灣核心-過敏或不耐症 (TW Core AllergyIntolerance)
  * 臺灣核心-病情、問題或診斷 (TW Core Condition)
  * 臺灣核心-處置或手術 (TW Core Procedure)
  * 臺灣核心-觀察 (TW Core Observation)

| 層級           | 名稱             | 補充                                                         |
| -------------- | ---------------- | ------------------------------------------------------------ |
| TWCORE-OPD-004 | 一般門診(成人)   | 延續 Level 1，加入生命徵象(BP、HR)與簡單檢驗(如血糖)     |
| TWCORE-OPD-005 | 小兒門診         | 延續 Level 1，加入體溫(Temp)、體重、基本檢驗               |
| TWCORE-OPD-006 | 同病人多次門診   | 延續 Level 1，加入多次檢驗紀錄(趨勢資料，如血壓追蹤)       |
| TWCORE-ER-002  | 急診             | 延續 Level 1，加入即時檢驗(SpO2、HR)與緊急處置             |
| TWCORE-IPD-002 | 住院             | 延續 Level 1，加入連續性檢驗(每日 vital signs、實驗室檢查) |

### 測試情境 LEVEL 3: 用藥與檢查

#### 概念說明 (Level 3)

本層級除延續Level 2的Observation(單一檢驗數值)外，進一步加入「檢查報告型資料」，如實驗室檢驗報告(DiagnosticReport)、影像報告與病理報告，使資料從「單點數值」提升為「臨床判讀結果」，更貼近實際醫療流程。。此層級重點在於:

* 用藥資訊的結構化
* 診斷與用藥之間的關聯
* 加入檢查(影像報告、實驗室檢驗報告(例如: 檢查套組)、病理檢查、等)

#### 測試目的 (LEVEL 3)

本測試情境的目的說明如下:

* (1) **驗證用藥資料轉換能力:** 確保開立的藥物處方資料可正確轉為FHIR格式。
* (2) **建立診斷與用藥的臨床關聯:** 開立藥物處方後用來驗證處方箋、調劑紀錄、用藥、以及藥物資訊的關係是否正確對應。
* (3) **模擬實際臨床用藥情境:** 驗證不同開立藥物的情境，包含:單一處方 (例如止痛藥)、急性用藥(感冒藥)、慢性用藥(高血壓)、同時開立多種藥物等。
* (4) **驗證用藥代碼與標準:** 測試藥物的代碼與內容是否符合TW Core Profile，例如: 藥品代碼(健保碼/ATC)、劑量與單位等。以下是常見的欄位
  * 藥品代碼(code)
  * 藥品名稱(display)
  * 劑量(dosage)
  * 頻率(frequency)
  * 用藥天數(duration)
  * 開立時間(authoredOn)
  * 單位(unit)
* (5) **驗證檢查報告整合能力:** 確保系統可將多筆Observation正確整合為DiagnosticReport，並與Encounter與 Condition建立關聯。

* 本層級除了LEVEL 1與LEVEL 2包含的FHIR Resource以外，至少涵蓋以下FHIR Resource:
  * 臺灣核心-診斷報告 (TW Core DiagnosticReport)
  * 臺灣核心-藥品(TW Core Medication)
  * 臺灣核心-藥品請求 (TW Core MedicationRequest)

| 層級           | 名稱             | 補充(升級版)                                              |
| -------------- | ---------------- | ----------------------------------------------------------- |
| TWCORE-OPD-007 | 一般門診(成人) | 感冒情境:生命徵象 + CBC + 開立感冒藥                       |
| TWCORE-OPD-008 | 小兒門診         | 發燒情境:體溫 + CBC + 尿液檢查 + 退燒藥                    |
| TWCORE-OPD-009 | 同病人多次門診   | 慢性病(高血壓/糖尿病):多次Observation + HbA1c + 長期用藥 |
| TWCORE-ER-003  | 急診             | 胸痛:ECG(可簡化)、Troponin + CXR報告 + 緊急用藥          |
| TWCORE-IPD-003 | 住院             | 手術/住院:每日vital + Lab panel + 病理報告 + 多重用藥      |

## 專案結構

```
FHIRfox/
├── database/            # HIS 模擬資料庫 (Schema + Seed Data)
├── dataset/             # 來源資料集與轉換規則
│   ├── resources/       #   各資源類型的來源資料 (JSON) 與欄位定義 (YAML)
│   ├── converter/       #   HIS → FHIR 對應規則與代碼對應 (CSV)
│   └── scenarios/       #   情境後設資料
├── scenarios/           # 測試情境定義 (YAML)
└── generator/           # TypeScript Monorepo (npm workspaces)
    ├── converter/       #   @fhirfox/converter — HIS→FHIR 轉換引擎
    ├── dataset/         #   @fhirfox/dataset — 資料集管理與驗證
    └── frontend/        #   @fhirfox/frontend — 情境瀏覽器 Web UI
```

> 完整專案結構、套件 API 與部署流程請參閱 **[技術手冊 (TECHNICAL.md)](TECHNICAL.md)**

## 使用方式

### 快速開始

```bash
cd generator
npm install
npm run build --workspace converter --workspace dataset
npm run dev --workspace frontend
```

開發伺服器啟動後即可在瀏覽器中檢視測試情境與 FHIR 輸出。

### 資料集驗證

```bash
cd generator
npm run dataset:check    # 快速驗證
npm run dataset:doctor   # 詳細報告
```

### 線上瀏覽

情境瀏覽器已部署於 GitHub Pages：https://cylab-tw.github.io/fhirfox/

## 聲明

本專案所有資料皆為合成資料 (Synthetic Data)，不涉及任何真實病人資訊，僅供測試、研究與教學用途。

## 未來規劃 (Roadmap )

* [ ] 情境驅動資料生成器 (Scenario Generator)
* [ ] 自動產生FHIR Bundle
* [ ] FHIR Validator整合
* [ ] DICOM/ImagingStudy擴充
* [ ] CLI工具化

## 貢獻方式

歡迎參與貢獻：

* 新增臨床情境 (Scenarios)
* 擴充FHIR IG支援
* 提升資料真實性
* 開發驗證工具

## 授權

Apache License 2.0

## Trademark Notice

FHIRfox 為本專案之名稱與品牌識別。未經授權，不得以 FHIRfox 名義用於商業產品或服務。

## 貢獻者 

* [楊斯惟 (Si-Wei Yang)](https://github.com/yangszwei)
* [kcfan041](https://github.com/kcfan041)
* [李德真](https://github.com/derlihihi)
* [張雯柔](https://github.com/tracy7894)
* [楊宇凡 (Lorex L. Yang) @ 矽塔資訊](https://github.com/Lorex)

* **註記:** 主要由[CYLAB-TW](https://cylab.dicom.tw)成員維護，歡迎以任何形式加入CYLAB-TW

## 致謝

* 本專案源於實務上醫療資訊互通與 FHIR 實作需求，致力於提供高品質合成資料，以支援醫療資訊標準發展。
* This project was supported by grants from the Taiwan Ministry of Science and Technology.
* We also acknowledge the support from the Department of Information Management and the National Health Insurance Administration, Ministry of Health and Welfare, Taiwan.
