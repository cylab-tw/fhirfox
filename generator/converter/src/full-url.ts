import type { FhirResource } from './types.js';

export function buildBundleFullUrl(fullUrlBase: string | undefined, resource: FhirResource): string | undefined {
	if (!resource.id) {
		return undefined;
	}

	if (!fullUrlBase) {
		return `urn:uuid:${buildDeterministicUuid(resource.resourceType, resource.id)}`;
	}

	const normalizedBase = fullUrlBase.endsWith('/') ? fullUrlBase.slice(0, -1) : fullUrlBase;
	return `${normalizedBase}/${resource.resourceType}/${resource.id}`;
}

export function buildBundleReferenceIndex(
	resources: FhirResource[],
	fullUrlBase: string | undefined,
): Map<string, string> {
	const index = new Map<string, string>();

	for (const resource of resources) {
		const fullUrl = buildBundleFullUrl(fullUrlBase, resource);

		if (fullUrl && resource.id) {
			index.set(`${resource.resourceType}/${resource.id}`, fullUrl);
		}
	}

	return index;
}

export function rewriteBundleReferences<TValue>(value: TValue, fullUrlByReference: Map<string, string>): TValue {
	if (Array.isArray(value)) {
		return value.map((entry) => rewriteBundleReferences(entry, fullUrlByReference)) as TValue;
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const record = value as Record<string, unknown>;
	const rewritten: Record<string, unknown> = {};

	for (const [key, entryValue] of Object.entries(record)) {
		if (key === 'reference' && typeof entryValue === 'string') {
			rewritten[key] = fullUrlByReference.get(entryValue) ?? entryValue;
			continue;
		}

		rewritten[key] = rewriteBundleReferences(entryValue, fullUrlByReference);
	}

	return rewritten as TValue;
}

/** RFC 4122 URL namespace UUID: 6ba7b811-9dad-11d1-80b4-00c04fd430c8 */
const UUID_NAMESPACE_URL = new Uint8Array([
	0x6b, 0xa7, 0xb8, 0x11, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
]);

const FHIRFOX_URI_PREFIX = 'https://fhirfox.dev/';

/**
 * Generates a deterministic RFC 4122 UUIDv5 from a resource type and ID.
 *
 * Uses the standard URL namespace with a FHIRfox-specific URI prefix so that
 * identical (resourceType, resourceId) pairs always produce the same UUID.
 */
function buildDeterministicUuid(resourceType: string, resourceId: string): string {
	const name = `${FHIRFOX_URI_PREFIX}${resourceType}/${resourceId}`;
	const nameBytes = new TextEncoder().encode(name);

	const input = new Uint8Array(UUID_NAMESPACE_URL.length + nameBytes.length);
	input.set(UUID_NAMESPACE_URL);
	input.set(nameBytes, UUID_NAMESPACE_URL.length);

	const hash = sha1(input);

	// RFC 4122 §4.3: set version (5) and variant (10xx) bits on the first 16 bytes.
	hash[6] = (hash[6] & 0x0f) | 0x50;
	hash[8] = (hash[8] & 0x3f) | 0x80;

	const hex = Array.from(hash.subarray(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Synchronous SHA-1 (FIPS 180-4) — used only for UUIDv5 generation. */
function sha1(message: Uint8Array): Uint8Array {
	const bitLength = message.length * 8;
	const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
	const padded = new Uint8Array(paddedLength);
	padded.set(message);
	padded[message.length] = 0x80;
	const dv = new DataView(padded.buffer);
	dv.setUint32(paddedLength - 4, bitLength, false);

	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;

	const w = new Uint32Array(80);

	for (let offset = 0; offset < paddedLength; offset += 64) {
		for (let i = 0; i < 16; i++) {
			w[i] = dv.getUint32(offset + i * 4, false);
		}
		for (let i = 16; i < 80; i++) {
			const v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
			w[i] = (v << 1) | (v >>> 31);
		}

		let a = h0,
			b = h1,
			c = h2,
			d = h3,
			e = h4;

		for (let i = 0; i < 80; i++) {
			let f: number, k: number;
			if (i < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (i < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (i < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}

			const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
			e = d;
			d = c;
			c = (b << 30) | (b >>> 2);
			b = a;
			a = temp;
		}

		h0 = (h0 + a) | 0;
		h1 = (h1 + b) | 0;
		h2 = (h2 + c) | 0;
		h3 = (h3 + d) | 0;
		h4 = (h4 + e) | 0;
	}

	const result = new Uint8Array(20);
	const rv = new DataView(result.buffer);
	rv.setUint32(0, h0, false);
	rv.setUint32(4, h1, false);
	rv.setUint32(8, h2, false);
	rv.setUint32(12, h3, false);
	rv.setUint32(16, h4, false);
	return result;
}
