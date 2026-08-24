import api from '@/api';

export type Automation = {
	id: number;
	name: string;
	enabled: boolean;
	sound_name: string;
	at: string; // "HH:MM", время сервера
	weekdays: number[]; // 0=пн … 6=вс
};

export type AutomationCreateRequest = {
	name: string;
	sound_name: string;
	at: string;
	weekdays: number[];
	enabled?: boolean;
};

export type AutomationUpdateRequest = Partial<AutomationCreateRequest>;

export const getAutomations = async (): Promise<Automation[]> =>
	(await api.get<Automation[]>('school/automations')).data;

export const getAutomation = async (id: number): Promise<Automation> =>
	(await api.get<Automation>(`school/automations/${id}`)).data;

export const createAutomation = async (
	req: AutomationCreateRequest
): Promise<Automation> =>
	(await api.post<Automation>('school/automations', req)).data;

export const updateAutomation = async (
	id: number,
	req: AutomationUpdateRequest
): Promise<Automation> =>
	(await api.patch<Automation>(`school/automations/${id}`, req)).data;

export const deleteAutomation = async (id: number): Promise<void> =>
	(await api.delete(`school/automations/${id}`)).data;

export const runAutomation = async (id: number): Promise<void> =>
	(await api.post(`school/automations/${id}/run`)).data;
