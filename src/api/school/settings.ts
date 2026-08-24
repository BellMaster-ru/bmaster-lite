import api, { HTTP_BASE_URL } from '@/api';

const SETTINGS_API_DEBUG_NAMESPACE = '[settings/api]';

const logSettingsApi = (event: string, payload?: unknown) => {
	if (payload === undefined) {
		console.log(SETTINGS_API_DEBUG_NAMESPACE, event);
		return;
	}
	console.log(SETTINGS_API_DEBUG_NAMESPACE, event, payload);
};

export type SchoolSettingsExportOptions = {
	schedules: boolean;
	assignments: boolean;
	overrides: boolean;
	automations: boolean;
};

const toBooleanParam = (value: boolean) => (value ? 'true' : 'false');

export const getSchoolSettingsExportUrl = (
	options: SchoolSettingsExportOptions
) => {
	const params = new URLSearchParams({
		schedules: toBooleanParam(options.schedules),
		assignments: toBooleanParam(options.assignments),
		overrides: toBooleanParam(options.overrides),
		automations: toBooleanParam(options.automations)
	});

	return `${HTTP_BASE_URL}/api/settings/settings?${params.toString()}`;
};

export const importSchoolSettingsFile = async (file: File) => {
	const form = new FormData();
	form.append('file', file);
	return (await api.post('settings/settings', form)).data;
};

export const exportSchoolSettingsFile = async (
	options: SchoolSettingsExportOptions
) =>
	(
		await api.get('settings/settings', {
			params: {
				schedules: options.schedules,
				assignments: options.assignments,
				overrides: options.overrides,
				automations: options.automations
			},
			responseType: 'blob'
		})
	).data as Blob;

const getFilenameFromContentDisposition = (headerValue?: string) => {
	if (!headerValue) {
		return undefined;
	}

	const encodedFilenameMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
	if (encodedFilenameMatch?.[1]) {
		try {
			return decodeURIComponent(encodedFilenameMatch[1].trim().replace(/["']/g, ''));
		} catch {
			// If decoding fails, try plain filename extraction.
		}
	}

	const filenameMatch = headerValue.match(/filename="?([^";]+)"?/i);
	return filenameMatch?.[1]?.trim();
};

export const downloadSchoolCertificate = async () => {
	const response = await api.get('certs/download', { responseType: 'blob' });
	const contentDisposition = response.headers?.['content-disposition'];

	return {
		blob: response.data as Blob,
		fileName: getFilenameFromContentDisposition(contentDisposition)
	};
};

export const setSchoolVolume = async (volume: number) =>
	(await api.put('settings/volume', { volume })).data;

export type SettingsVolumeResponse = {
	ok: boolean;
	volume: number;
};

export const getSettingsVolume = async () =>
	(await api.get('settings/volume')).data;

export type GpioState = {
	enabled: boolean;
	pin: number;
	active_high: boolean;
	off_delay: number;
	chip: string | null;
	available: boolean;
	active: boolean;
	detail: string | null;
};

export type GpioSettingsPatch = Partial<Pick<GpioState, 'enabled' | 'pin'>>;

export const getGpioSettings = async () =>
	(await api.get<GpioState>('settings/gpio')).data;

export const updateGpioSettings = async (patch: GpioSettingsPatch) =>
	(await api.put<GpioState>('settings/gpio', patch)).data;

export const checkSchoolUpdates = async () => {
	logSettingsApi('check_updates_start');
	try {
		const response = (
			await api.get<CheckSchoolUpdatesResponse>('settings/check_updates')
		).data;
		logSettingsApi('check_updates_success', response);
		return response;
	} catch (error) {
		logSettingsApi('check_updates_error', error);
		throw error;
	}
};

export type CheckSchoolUpdatesResponse = {
	status?: string;
	has_updates?: boolean;
	backend_has_updates?: boolean;
	frontend_has_updates?: boolean;
};

export type UpdateSchoolSoftwareResponse = {
	ok?: boolean;
	status?: string;
	detail?: string;
};

export const updateSchoolSoftware = async () => {
	logSettingsApi('update_start');
	try {
		const response = (await api.post<UpdateSchoolSoftwareResponse>('settings/update'))
			.data;
		logSettingsApi('update_success', response);
		return response;
	} catch (error) {
		logSettingsApi('update_error', error);
		throw error;
	}
};

export type SchoolHealthResponse = {
	ok?: boolean;
};

export type SchoolHealthOptions = {
	timeoutMs?: number;
};

export const getSchoolHealth = async (options?: SchoolHealthOptions) => {
	logSettingsApi('health_start', options);
	try {
		const response = (
			await api.get<SchoolHealthResponse>('health', {
				timeout: options?.timeoutMs
			})
		).data;
		logSettingsApi('health_success', response);
		return response;
	} catch (error) {
		logSettingsApi('health_error', {
			options,
			error
		});
		throw error;
	}
};

export const rebootSchoolDevice = async () => {
	logSettingsApi('reboot_start');
	try {
		const response = (await api.post('settings/reboot')).data;
		logSettingsApi('reboot_success', response);
		return response;
	} catch (error) {
		logSettingsApi('reboot_error', error);
		throw error;
	}
};
