import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import chevronLeft from '@iconify-icons/mdi/chevron-left';

import { JsonViewer } from './json-viewer/JsonViewer.js';
import { createScenarioBrowserJsonViewerExtensionsForValue } from '../helpers/scenario-browser/json-viewer-adapter.js';
import { formatSourceResourceType } from '../lib/source-resource-display.js';

import type {
	PreviewResourceItem,
	ResourceJumpScrollBehavior,
	ResourceJumpTarget,
	SourceCodeDisplayMap,
	SourceFieldDocRecord,
} from '../types.js';

interface ResourcePreviewProps {
	resources: PreviewResourceItem[];
	sourceFieldDocs: Record<string, SourceFieldDocRecord>;
	sourceCodeDisplayMap: SourceCodeDisplayMap;
	docsEnabled: boolean;
	showCodeDisplayValues?: boolean;
	onSourceResourceSelect?: (sourceKey: string) => void;
	scrollToResourceType?: ResourceJumpTarget | null;
	scrollBehavior?: ResourceJumpScrollBehavior;
	onExpandedResourceTypeChange?: (resourceType: string | null) => void;
}

export function ResourcePreview({
	resources,
	sourceFieldDocs,
	sourceCodeDisplayMap,
	docsEnabled,
	showCodeDisplayValues = false,
	onSourceResourceSelect,
	scrollToResourceType = null,
	scrollBehavior = 'smooth',
	onExpandedResourceTypeChange,
}: ResourcePreviewProps) {
	const [expandedResourceId, setExpandedResourceId] = useState(resources[0]?.id ?? '');
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const resourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const pendingScrollResourceIdRef = useRef<string | null>(null);

	useEffect(() => {
		setExpandedResourceId((current) => {
			if (current && resources.some((resource) => resource.id === current)) {
				return current;
			}

			return resources[0]?.id ?? '';
		});
	}, [resources]);

	useEffect(() => {
		if (!scrollToResourceType) {
			return;
		}

		if (scrollToResourceType.sourceKey) {
			const exactMatch = resources.find((resource) => resource.sourceKey === scrollToResourceType.sourceKey);

			if (!exactMatch) {
				return;
			}

			pendingScrollResourceIdRef.current = exactMatch.id;
			setExpandedResourceId(exactMatch.id);
			return;
		}

		const matchingResources = resources.filter(
			(resource) => resource.resourceType.toLowerCase() === scrollToResourceType.resourceType.toLowerCase(),
		);

		if (matchingResources.length === 0) {
			return;
		}

		const nextIndex = scrollToResourceType.ordinal % matchingResources.length;
		const target = matchingResources[nextIndex] ?? matchingResources[0];

		pendingScrollResourceIdRef.current = target.id;
		setExpandedResourceId(target.id);
	}, [resources, scrollToResourceType]);

	useEffect(() => {
		const pendingScrollResourceId = pendingScrollResourceIdRef.current;

		if (!pendingScrollResourceId || pendingScrollResourceId !== expandedResourceId) {
			return;
		}

		const scrollContainer = scrollContainerRef.current;
		const target = resourceRefs.current[pendingScrollResourceId];

		if (!scrollContainer || !target) {
			pendingScrollResourceIdRef.current = null;
			return;
		}

		const scrollToTarget = () => {
			const containerRect = scrollContainer.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			const top = scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 20;

			scrollContainer.scrollTo({
				top: Math.max(0, top),
				behavior: scrollBehavior,
			});
			pendingScrollResourceIdRef.current = null;
		};

		let secondFrame: number | null = null;
		const firstFrame = window.requestAnimationFrame(() => {
			secondFrame = window.requestAnimationFrame(scrollToTarget);
		});

		return () => {
			window.cancelAnimationFrame(firstFrame);

			if (secondFrame !== null) {
				window.cancelAnimationFrame(secondFrame);
			}
		};
	}, [expandedResourceId, scrollBehavior]);

	useEffect(() => {
		if (!onExpandedResourceTypeChange) {
			return;
		}

		const expandedResource = resources.find((resource) => resource.id === expandedResourceId);
		onExpandedResourceTypeChange(expandedResource?.resourceType ?? null);
	}, [expandedResourceId, onExpandedResourceTypeChange, resources]);

	return (
		<div className="flex h-[72dvh] min-h-[420px] flex-col xl:h-full xl:min-h-0">
			<div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto">
				<div className="grid gap-3 px-3 py-4 sm:px-6 sm:py-5">
					{resources.map((resource) => {
						const isExpanded = resource.id === expandedResourceId;

						return (
							<div
								key={resource.id}
								ref={(node) => {
									resourceRefs.current[resource.id] = node;
								}}
								className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:rounded-2xl"
							>
								<button
									type="button"
									onClick={() => {
										pendingScrollResourceIdRef.current = null;
										setExpandedResourceId((current) => (current === resource.id ? '' : resource.id));
									}}
									className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 sm:px-4 sm:py-4"
									aria-expanded={isExpanded}
								>
									<span className="min-w-0 text-[14px] leading-5 break-words text-slate-600 sm:truncate sm:text-[15px]">
										<span className="font-semibold text-slate-950">
											{formatPreviewResourceTitle(resource.resourceType, resource.title)}
										</span>
										{resource.subtitle ? <span className="ml-2 text-slate-500">{resource.subtitle}</span> : null}
									</span>
									<span
										className={[
											'inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition',
											isExpanded ? '-rotate-90' : 'rotate-0',
										].join(' ')}
									>
										<Icon icon={chevronLeft} className="h-3 w-3 shrink-0" />
									</span>
								</button>
								{isExpanded ? (
									<div className="border-t border-slate-200 bg-slate-50/40">
										<div className="min-h-0">
											<JsonViewer
												value={resource.resource}
												extensions={createScenarioBrowserJsonViewerExtensionsForValue({
													value: resource.resource,
													sourceFieldDocs,
													sourceCodeDisplayMap,
													docsEnabled,
													showCodeDisplayValues,
													onSourceResourceSelect,
												})}
												className="rounded-none border-0 shadow-none"
											/>
										</div>
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function formatPreviewResourceTitle(resourceType: string, title: string): string {
	const formattedType = formatSourceResourceType(resourceType);
	return title.length > 0 ? `${formattedType}/${title}` : formattedType;
}
