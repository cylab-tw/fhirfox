import { randomFor } from '#/generators/random.js';

import type { GeneratorFunction } from '#/generators/types.js';

interface DistrictAddressData {
	city: string;
	district: string;
	roads: RoadData[];
}

interface RoadData {
	name: string;
	sections?: number[];
}

const districts: DistrictAddressData[] = [
	{
		city: '臺北市',
		district: '中正區',
		roads: [
			{ name: '中山南路' },
			{ name: '羅斯福路', sections: [1, 2] },
			{ name: '忠孝西路', sections: [1] },
			{ name: '忠孝東路', sections: [1, 2] },
			{ name: '仁愛路', sections: [1, 2] },
			{ name: '杭州南路', sections: [1, 2] },
			{ name: '重慶南路', sections: [1, 2, 3] },
			{ name: '信義路', sections: [1, 2] },
		],
	},
	{
		city: '臺北市',
		district: '大安區',
		roads: [
			{ name: '仁愛路', sections: [3, 4] },
			{ name: '信義路', sections: [3, 4] },
			{ name: '和平東路', sections: [1, 2, 3] },
			{ name: '復興南路', sections: [1, 2] },
			{ name: '敦化南路', sections: [1, 2] },
			{ name: '新生南路', sections: [1, 2, 3] },
			{ name: '建國南路', sections: [1, 2] },
			{ name: '辛亥路', sections: [1, 2, 3] },
		],
	},
	{
		city: '臺北市',
		district: '信義區',
		roads: [
			{ name: '信義路', sections: [4, 5, 6] },
			{ name: '忠孝東路', sections: [4, 5] },
			{ name: '松仁路' },
			{ name: '松智路' },
			{ name: '基隆路', sections: [1, 2] },
			{ name: '莊敬路' },
			{ name: '吳興街' },
			{ name: '松德路' },
		],
	},
	{
		city: '新北市',
		district: '板橋區',
		roads: [
			{ name: '文化路', sections: [1, 2] },
			{ name: '民生路', sections: [1, 2, 3] },
			{ name: '中山路', sections: [1, 2] },
			{ name: '四川路', sections: [1, 2] },
			{ name: '縣民大道', sections: [1, 2, 3] },
			{ name: '館前東路' },
			{ name: '府中路' },
			{ name: '新海路' },
		],
	},
	{
		city: '新北市',
		district: '新店區',
		roads: [
			{ name: '北新路', sections: [1, 2, 3] },
			{ name: '中正路' },
			{ name: '民權路' },
			{ name: '安康路', sections: [1, 2, 3] },
			{ name: '寶橋路' },
			{ name: '建國路' },
			{ name: '中央路' },
			{ name: '新店路' },
		],
	},
	{
		city: '桃園市',
		district: '桃園區',
		roads: [
			{ name: '中正路' },
			{ name: '中山路' },
			{ name: '復興路' },
			{ name: '民生路' },
			{ name: '大興西路', sections: [1, 2, 3] },
			{ name: '春日路' },
			{ name: '經國路' },
			{ name: '同德六街' },
		],
	},
	{
		city: '臺中市',
		district: '西區',
		roads: [
			{ name: '公益路' },
			{ name: '民權路' },
			{ name: '臺灣大道', sections: [1, 2] },
			{ name: '美村路', sections: [1] },
			{ name: '英才路' },
			{ name: '向上路', sections: [1] },
			{ name: '忠明南路' },
			{ name: '五權西路', sections: [1] },
		],
	},
	{
		city: '臺中市',
		district: '北屯區',
		roads: [
			{ name: '崇德路', sections: [2, 3] },
			{ name: '文心路', sections: [3, 4] },
			{ name: '太原路', sections: [3] },
			{ name: '北屯路' },
			{ name: '松竹路', sections: [1, 2, 3] },
			{ name: '軍功路', sections: [1, 2] },
			{ name: '東山路', sections: [1, 2] },
			{ name: '昌平路', sections: [1, 2] },
		],
	},
	{
		city: '臺南市',
		district: '中西區',
		roads: [
			{ name: '民生路', sections: [1, 2] },
			{ name: '民權路', sections: [1, 2] },
			{ name: '中正路' },
			{ name: '西門路', sections: [1, 2] },
			{ name: '府前路', sections: [1, 2] },
			{ name: '成功路' },
			{ name: '永福路', sections: [1, 2] },
			{ name: '海安路', sections: [1, 2] },
		],
	},
	{
		city: '臺南市',
		district: '東區',
		roads: [
			{ name: '東門路', sections: [1, 2, 3] },
			{ name: '林森路', sections: [1, 2] },
			{ name: '崇學路' },
			{ name: '中華東路', sections: [1, 2, 3] },
			{ name: '裕農路' },
			{ name: '大同路', sections: [1, 2] },
			{ name: '長榮路', sections: [1, 2, 3] },
			{ name: '勝利路' },
		],
	},
	{
		city: '高雄市',
		district: '苓雅區',
		roads: [
			{ name: '成功一路' },
			{ name: '四維三路' },
			{ name: '和平一路' },
			{ name: '三多一路' },
			{ name: '三多二路' },
			{ name: '中正一路' },
			{ name: '光華一路' },
			{ name: '武廟路' },
		],
	},
	{
		city: '高雄市',
		district: '左營區',
		roads: [
			{ name: '博愛二路' },
			{ name: '明誠二路' },
			{ name: '自由二路' },
			{ name: '華夏路' },
			{ name: '重愛路' },
			{ name: '左營大路' },
			{ name: '裕誠路' },
			{ name: '新莊一路' },
		],
	},
];

/** Generates a deterministic Taiwan address from district-specific road lists and house number parts. */
export const taiwanAddressGenerator: GeneratorFunction = (_args, context) => {
	const district = pick(districts, randomFor(context, 'taiwanAddress:district'));
	const road = pick(district.roads, randomFor(context, `taiwanAddress:road:${district.city}:${district.district}`));
	const section = road.sections
		? `${pick(road.sections, randomFor(context, `taiwanAddress:section:${road.name}`))}段`
		: '';
	const lane =
		randomFor(context, 'taiwanAddress:lane') < 0.35
			? `${range(randomFor(context, 'taiwanAddress:lane:value'), 1, 299)}巷`
			: '';
	const alley =
		lane && randomFor(context, 'taiwanAddress:alley') < 0.25
			? `${range(randomFor(context, 'taiwanAddress:alley:value'), 1, 39)}弄`
			: '';
	const number = `${range(randomFor(context, 'taiwanAddress:number'), 1, 499)}號`;
	const subNumber =
		randomFor(context, 'taiwanAddress:subNumber') < 0.12
			? `之${range(randomFor(context, 'taiwanAddress:subNumber:value'), 1, 5)}`
			: '';
	const floor =
		randomFor(context, 'taiwanAddress:floor') < 0.28
			? `${range(randomFor(context, 'taiwanAddress:floor:value'), 2, 18)}樓`
			: '';

	return `${district.city}${district.district}${road.name}${section}${lane}${alley}${number}${subNumber}${floor}`;
};

function pick<T>(values: T[], random: number): T {
	return values[Math.min(Math.floor(random * values.length), values.length - 1)] ?? values[0]!;
}

function range(random: number, min: number, max: number): number {
	return min + Math.floor(random * (max - min + 1));
}
