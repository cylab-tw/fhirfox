import { runCheck } from './check.js';
import { runDoctor } from './doctor.js';
import { runResolve } from './resolve.js';

const command = process.argv[2] ?? 'check';

if (command === 'doctor') {
	runDoctor();
} else if (command === 'resolve') {
	await runResolve();
} else {
	runCheck();
}
