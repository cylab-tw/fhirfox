import { dirname, resolve } from 'node:path';

import { fileURLToPath } from 'node:url';

import express from 'express';

import { generateResourceByRules } from './src/generator/generate-resource.js';

import { GeneratorRepository } from './src/repositories/generator-repository.js';

import { executeScenario } from './src/scenarios/execute-scenario.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const repository = new GeneratorRepository();
const igName = process.env.IG_NAME ?? 'tw.gov.mohw.twcore';
const igVersion = process.env.IG_VERSION ?? '1.0.0';
const serverDirectory = dirname(fileURLToPath(import.meta.url));
const scenarioRootDirectory = process.env.SCENARIO_DIR ?? resolve(serverDirectory, '../scenarios');

app.get('/', (_req, res) => {
	res.json({
		name: 'FHIRfox generator',
		endpoints: ['/twcore/:resourceType/:id', '/twcore/scenarios/:scenarioId'],
		ig: `${igName}#${igVersion}`,
		resourceTypeHint: 'Use the exact FHIR resource type configured in generator_rule.',
		scenarioDirectory: scenarioRootDirectory,
	});
});

app.get('/twcore/scenarios/:scenarioId', async (req, res) => {
	try {
		const result = await executeScenario({
			igName,
			igVersion,
			scenarioId: req.params.scenarioId,
			scenarioRootDirectory,
			repository,
		});

		res.json(result);
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : 'Unexpected scenario error.',
		});
	}
});

app.get('/twcore/:resourceType/:id', async (req, res) => {
	try {
		const resource = await generateResourceByRules(
			{
				igName,
				igVersion,
				resourceType: req.params.resourceType,
				id: req.params.id,
			},
			repository,
		);

		if (!resource) {
			res.status(404).json({
				error: `${req.params.resourceType} ${req.params.id} was not found.`,
			});
			return;
		}

		res.json(resource);
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('No rules found for resource type ')) {
			res.status(404).json({
				error: error.message,
			});
			return;
		}

		res.status(500).json({
			error: error instanceof Error ? error.message : 'Unexpected generator error.',
		});
	}
});

app.listen(port, () => {
	console.log(`FHIRfox generator listening on port ${port}`);
});
