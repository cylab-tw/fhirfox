CREATE SCHEMA IF NOT EXISTS fhirfox;

CREATE TABLE IF NOT EXISTS fhirfox.generator_rule (
    rule_id BIGSERIAL PRIMARY KEY,
    ig_name TEXT NOT NULL,
    ig_version TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    source_table TEXT NOT NULL,
    source_column TEXT NOT NULL,
    fhir_path TEXT NOT NULL,
    data_type TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    transform_kind TEXT NOT NULL DEFAULT 'copy',
    mapping_key TEXT,
    reference_target TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT generator_rule_transform_kind_check CHECK (
        transform_kind IN ('copy', 'code_map', 'build_reference')
    ),
    CONSTRAINT generator_rule_mapping_key_required CHECK (
        transform_kind <> 'code_map' OR mapping_key IS NOT NULL
    ),
    CONSTRAINT generator_rule_reference_target_required CHECK (
        transform_kind <> 'build_reference' OR reference_target IS NOT NULL
    ),
    CONSTRAINT generator_rule_unique UNIQUE (
        ig_name,
        ig_version,
        resource_type,
        source_table,
        source_column,
        fhir_path
    )
);

CREATE INDEX IF NOT EXISTS generator_rule_lookup_idx
    ON fhirfox.generator_rule (ig_name, ig_version, resource_type, is_active, sort_order);

CREATE TABLE IF NOT EXISTS fhirfox.resource_profile (
    resource_profile_id BIGSERIAL PRIMARY KEY,
    ig_name TEXT NOT NULL,
    ig_version TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    profile_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT resource_profile_unique UNIQUE (ig_name, ig_version, resource_type)
);

CREATE INDEX IF NOT EXISTS resource_profile_lookup_idx
    ON fhirfox.resource_profile (ig_name, ig_version, resource_type, is_active);

CREATE TABLE IF NOT EXISTS fhirfox.code_mapping (
    mapping_id BIGSERIAL PRIMARY KEY,
    mapping_key TEXT NOT NULL,
    source_code TEXT NOT NULL,
    target_code TEXT NOT NULL,
    target_display TEXT,
    target_system TEXT NOT NULL,
    display_zh_tw TEXT,
    group_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT code_mapping_unique UNIQUE (mapping_key, source_code)
);

CREATE INDEX IF NOT EXISTS code_mapping_lookup_idx
    ON fhirfox.code_mapping (mapping_key, source_code, is_active);
