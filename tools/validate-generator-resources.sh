#!/usr/bin/env bash
set -euo pipefail

output_file="${FHIRFOX_VALIDATION_OUTPUT:-/tmp/fhirfox/validate-generator-resources.json}"
validator_jar="${FHIR_VALIDATOR_JAR:-$HOME/.fhir/validator/validator_cli.jar}"
ig_package="${FHIR_IG_PACKAGE:-$HOME/.fhir/packages/tw.gov.mohw.twcore#1.0.0/package}"
fhir_version="${FHIR_VERSION:-4.0.1}"
validation_level="${FHIR_VALIDATION_LEVEL:-warnings}"

project_root="$(dirname "$(dirname "$(realpath "$0")")")"
input_dir="$project_root/generator/frontend/dist/data/scenarios"

if [[ ! -f "$validator_jar" ]]; then
	echo "FHIR validator jar not found: $validator_jar" >&2
	exit 1
fi

npm --prefix "$project_root/generator" run build

if [[ ! -d "$input_dir" ]]; then
	echo "Frontend scenario directory not found: $input_dir" >&2
	exit 1
fi

validation_inputs=("$@")
while IFS= read -r -d '' bundle_file; do
	validation_inputs+=("$bundle_file")
done < <(find "$input_dir" -mindepth 2 -maxdepth 2 -type f -name bundle.json -print0)

if [[ ${#validation_inputs[@]} -eq 0 ]]; then
	echo "No validation inputs found." >&2
	exit 1
fi

mkdir -p "$(dirname "$output_file")"

java -jar "$validator_jar" \
	"${validation_inputs[@]}" \
	-version "$fhir_version" \
	-ig "$ig_package" \
	-level "$validation_level" \
	-output "$output_file"

echo "Validation outcome written to $output_file"
