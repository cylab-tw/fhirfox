import { addMinutesGenerator } from './add-minutes.js';
import { bindingRefGenerator } from './binding-ref.js';
import { birthDateFromAgeGenerator } from './birth-date-from-age.js';
import { birthDateGenerator } from './birth-date.js';
import { caseGenerator } from './case.js';
import { caseNumberGenerator } from './case-number.js';
import { dateTimeGenerator } from './date-time.js';
import { humanNameGenerator } from './human-name.js';
import { idGenerator } from './id.js';
import { inputGenerator } from './input.js';
import { numberGenerator } from './number.js';
import { pickGenerator } from './pick.js';
import { refGenerator } from './ref.js';
import { taiwanAddressGenerator } from './taiwan-address.js';
import { taiwanMobilePhoneGenerator } from './taiwan-mobile-phone.js';
import { taiwanNationalIdGenerator } from './taiwan-national-id.js';
import { valueGenerator } from './value.js';

import type { GeneratorFunction } from '#/generators/types.js';

/** Creates the built-in generator entries used by the default registry. */
export function createBuiltinGeneratorEntries(): Array<[string, GeneratorFunction]> {
	return [
		['id', idGenerator],
		['input', inputGenerator],
		['case', caseGenerator],
		['caseNumber', caseNumberGenerator],
		['number', numberGenerator],
		['pick', pickGenerator],
		['humanName', humanNameGenerator],
		['taiwanNationalId', taiwanNationalIdGenerator],
		['taiwanMobilePhone', taiwanMobilePhoneGenerator],
		['taiwanAddress', taiwanAddressGenerator],
		['dateTime', dateTimeGenerator],
		['birthDate', birthDateGenerator],
		['birthDateFromAge', birthDateFromAgeGenerator],
		['addMinutes', addMinutesGenerator],
		['value', valueGenerator],
		['ref', refGenerator],
		['bindingRef', bindingRefGenerator],
	];
}
