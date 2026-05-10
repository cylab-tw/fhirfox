# Frontend

The frontend currently runs against generated JSON assets built from `dataset/`.

## Configuration

The Vite config currently reads these environment variables:

- `FHIRFOX_BASE_PATH`
  Optional base path for deploying the app under a subpath instead of `/`.
- `FHIRFOX_BACKEND_API_BASE_URL`
  Absolute backend API base URL used in backend deployment mode.
- `FHIRFOX_BACKEND_PROXY_TARGET`
  Optional local dev proxy target for `/api` when the frontend runs in backend mode.
- `FHIRFOX_DEFAULT_SEED`
  Default scenario seed used when the route does not provide one.

If `FHIRFOX_BASE_PATH` is not set, the frontend uses `/`.

Examples:

Run locally with the default base path:

```bash
npm run dev
```

Build for deployment under `/fhirfox/`:

```bash
FHIRFOX_BASE_PATH=/fhirfox/ npm run build
```

Build against a backend on port `8787`:

```bash
FHIRFOX_DEPLOYMENT_MODE=backend FHIRFOX_BACKEND_API_BASE_URL=/api npm run build
```

## Manifest contract

The generated manifest includes a `dataSource` field so the runtime data-loading contract is explicit.

Current generated-asset fields:

- `dataSource.kind`
  Identifies the runtime data-source implementation. Today this is `generated-asset`.
- `dataSource.scenarioIndexUrl`
  URL for the scenario index JSON.
- `dataSource.sourceFieldDocsUrl`
  URL for source field documentation JSON.
- `dataSource.sourceCodeDisplayMapUrl`
  URL for code-to-display lookup JSON.
- `dataSource.scenarioAssetBaseUrl`
  Base URL for per-scenario generated assets such as source results, bundles, and mapping metadata.

## Notes

- Generated assets are built from the repository `dataset/` directory.
- The manifest/data-source split is in place so future implementations can be added without rewriting the scenario browser state flow.
