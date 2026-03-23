CREATE SCHEMA IF NOT EXISTS twcore;

CREATE TABLE IF NOT EXISTS twcore.patient (
    patient_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    birthday DATE NOT NULL,
    organization_id TEXT
);

CREATE TABLE IF NOT EXISTS twcore.patient_identifier (
    patient_identifier_id BIGSERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES twcore.patient (patient_id) ON DELETE CASCADE,
    id_type TEXT NOT NULL,
    id_number TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT patient_identifier_unique UNIQUE (patient_id, id_type, id_number)
);

CREATE TABLE IF NOT EXISTS twcore.patient_telecom (
    patient_telecom_id BIGSERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES twcore.patient (patient_id) ON DELETE CASCADE,
    telecom_system TEXT,
    telecom_use TEXT,
    telecom_value TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.patient_address (
    patient_address_id BIGSERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES twcore.patient (patient_id) ON DELETE CASCADE,
    address_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.organization (
    organization_id TEXT PRIMARY KEY,
    active BOOLEAN,
    type TEXT,
    name TEXT NOT NULL,
    alias TEXT,
    part_of_id TEXT REFERENCES twcore.organization (organization_id)
);

CREATE TABLE IF NOT EXISTS twcore.organization_identifier (
    organization_identifier_id BIGSERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES twcore.organization (organization_id) ON DELETE CASCADE,
    id_type TEXT NOT NULL,
    id_number TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT organization_identifier_unique UNIQUE (organization_id, id_type, id_number)
);

CREATE TABLE IF NOT EXISTS twcore.organization_telecom (
    organization_telecom_id BIGSERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES twcore.organization (organization_id) ON DELETE CASCADE,
    telecom_system TEXT,
    telecom_use TEXT,
    telecom_value TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.organization_address (
    organization_address_id BIGSERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES twcore.organization (organization_id) ON DELETE CASCADE,
    address_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.organization_contact (
    organization_contact_id BIGSERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES twcore.organization (organization_id) ON DELETE CASCADE,
    contact_purpose TEXT,
    contact_name TEXT,
    contact_telecom TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.practitioner (
    practitioner_id TEXT PRIMARY KEY,
    active BOOLEAN,
    name TEXT NOT NULL,
    gender TEXT,
    birthday DATE
);

CREATE TABLE IF NOT EXISTS twcore.practitioner_identifier (
    practitioner_identifier_id BIGSERIAL PRIMARY KEY,
    practitioner_id TEXT NOT NULL REFERENCES twcore.practitioner (practitioner_id) ON DELETE CASCADE,
    id_type TEXT NOT NULL,
    id_number TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT practitioner_identifier_unique UNIQUE (practitioner_id, id_type, id_number)
);

CREATE TABLE IF NOT EXISTS twcore.practitioner_telecom (
    practitioner_telecom_id BIGSERIAL PRIMARY KEY,
    practitioner_id TEXT NOT NULL REFERENCES twcore.practitioner (practitioner_id) ON DELETE CASCADE,
    telecom_system TEXT,
    telecom_use TEXT,
    telecom_value TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.practitioner_address (
    practitioner_address_id BIGSERIAL PRIMARY KEY,
    practitioner_id TEXT NOT NULL REFERENCES twcore.practitioner (practitioner_id) ON DELETE CASCADE,
    address_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.practitioner_qualification (
    practitioner_qualification_id BIGSERIAL PRIMARY KEY,
    practitioner_id TEXT NOT NULL REFERENCES twcore.practitioner (practitioner_id) ON DELETE CASCADE,
    qualification_code TEXT,
    qualification_issuer_id TEXT REFERENCES twcore.organization (organization_id),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twcore.practitioner_role (
    role_id TEXT PRIMARY KEY,
    active BOOLEAN,
    practitioner_id TEXT REFERENCES twcore.practitioner (practitioner_id),
    organization_id TEXT REFERENCES twcore.organization (organization_id),
    location_id TEXT,
    role_code TEXT,
    specialty_code TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS twcore.practitioner_role_telecom (
    practitioner_role_telecom_id BIGSERIAL PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES twcore.practitioner_role (role_id) ON DELETE CASCADE,
    telecom_system TEXT,
    telecom_use TEXT,
    telecom_value TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'patient_organization_fk'
    ) THEN
        ALTER TABLE twcore.patient
            ADD CONSTRAINT patient_organization_fk
            FOREIGN KEY (organization_id) REFERENCES twcore.organization (organization_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS twcore.encounter (
    encounter_id TEXT PRIMARY KEY,
    identifier TEXT,
    status TEXT NOT NULL,
    class TEXT NOT NULL,
    service_type TEXT,
    patient_id TEXT NOT NULL REFERENCES twcore.patient (patient_id),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    service_provider_id TEXT REFERENCES twcore.organization (organization_id),
    part_of_id TEXT REFERENCES twcore.encounter (encounter_id),
    participant_type TEXT,
    practitioner_id TEXT NOT NULL REFERENCES twcore.practitioner (practitioner_id),
    location_id TEXT NOT NULL,
    location_status TEXT,
    condition_id TEXT NOT NULL,
    diagnosis_use TEXT,
    admit_source TEXT,
    discharge_disposition TEXT
);

CREATE TABLE IF NOT EXISTS twcore.allergy_intolerance (
    allergy_id TEXT PRIMARY KEY,
    clinical_status TEXT NOT NULL,
    verification_status TEXT,
    type TEXT,
    category TEXT,
    criticality TEXT,
    allergy_code TEXT NOT NULL,
    patient_id TEXT NOT NULL REFERENCES twcore.patient (patient_id),
    encounter_id TEXT REFERENCES twcore.encounter (encounter_id),
    onset_date TIMESTAMPTZ,
    recorded_date TIMESTAMPTZ NOT NULL,
    recorder_id TEXT NOT NULL REFERENCES twcore.practitioner (practitioner_id),
    note TEXT,
    reaction_substance TEXT,
    manifestation TEXT NOT NULL,
    severity TEXT NOT NULL,
    exposure_route TEXT
);
