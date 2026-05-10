import type { GeneratorFunction } from '#/generators/types.js';
import { birthDateGenerator } from './birth-date.js';

/** Generates a birth date from another generated or fixed age value. */
export const birthDateFromAgeGenerator: GeneratorFunction = ([age], context) => birthDateGenerator([age], context);
