# FHIRfox
FHIRfox: Pre-generated synthetic clinical dataset simulating a HIS for FHIR transformation and testing
**模擬醫院資訊系統（HIS）的合成式 FHIR 醫療資料集**

FHIRfox 是一個用於模擬真實醫療情境的**合成醫療資料（Synthetic Clinical Data）專案**，旨在建立一套類似醫院資訊系統（HIS）的資料庫，並支援 FHIR 資料轉換、測試與互通性驗證。

---
## 專案概述
FHIRfox提供**已預先生成（pre-generated）之合成醫療資料**，模擬真實臨床流程，包含：
* 門診（Outpatient）、急診（Emergency）、住院（Inpatient）
* 多科別就醫情境（心臟科、小兒科、骨科等）
* 病人長期就醫歷程（Longitudinal Records）
* 檢驗、診斷、用藥與影像等臨床資料

本專案主要用途包括：
* FHIR 實作與系統測試
* 醫療資訊互通性驗證（HL7® FHIR®）
* HIS → FHIR 資料轉換開發
* 聯測（Connectathon）與測試環境建置

## 核心特色
* [ ] 合成資料（非真實病人資料，無需即時生成）
* [ ] 模擬HIS關聯式資料庫結構
* [ ] 多情境（Scenario-based）設計
* [ ] 支援多種 FHIR IG（預設為TW Core，未來可擴充）
* [ ] 多格式輸出（SQL/JSON/FHIR JSON）

## 資料內容範圍
FHIRfox 依據臨床複雜度分層設計：
### Level 0：基礎就醫紀錄
* 病人基本資料（Patient）
* 就醫紀錄（Encounter：門診/急診/住院）
* 主訴與診斷（Condition）

### Level 1：臨床檢驗資料
* 生命徵象（Vital Signs）
* 血液/尿液檢查（Observation）
* 基本處置（Procedure）

### Level 2：用藥資料
* 處方（MedicationRequest）
* 慢性病用藥
* 多重用藥（Polypharmacy）

### Level 3：診斷與影像
* 影像檢查（X-ray / CT / MRI）
* 診斷報告（DiagnosticReport）
* 病理檢驗（Pathology）

## FHIR Resource 覆蓋
FHIRfox 對應以下核心 FHIR 資源：
* Patient
* Encounter
* Condition
* Observation
* MedicationRequest
* Procedure
* DiagnosticReport
* Organization
* Practitioner/PractitionerRole

## 專案結構 (待更新)
```id="fhirfox-structure"
FHIRfox/
│
├── database/          # HIS 模擬資料庫（Schema + Seed Data）
├── scenarios/         # 測試情境定義（門診 / 急診 / 住院等）
├── output/            # 已生成資料（SQL / CSV / FHIR JSON）
├── examples/          # 範例（FHIR Bundle / 使用情境）
├── igs/               # FHIR Core IG 設定（TW Core / US Core / IPS）
└── tools/             # 資料轉換或生成工具（選用）
```

## 使用方式 (待更新)

## 聲明
本專案所有資料皆為**合成資料（Synthetic Data）**，不涉及任何真實病人資訊，僅供測試、研究與教學用途。

## 未來規劃（Roadmap）
* [ ] 情境驅動資料生成器（Scenario Generator）
* [ ] 自動產生 FHIR Bundle
* [ ] FHIR Validator 整合
* [ ] DICOM/ImagingStudy 擴充
* [ ] CLI工具化

## 貢獻方式

歡迎參與貢獻：
* 新增臨床情境（Scenarios）
* 擴充 FHIR IG 支援
* 提升資料真實性
* 開發驗證工具

## 授權
MIT License

## 致謝
本專案源於實務上醫療資訊互通與 FHIR 實作需求，致力於提供高品質合成資料以支援醫療資訊標準發展。
