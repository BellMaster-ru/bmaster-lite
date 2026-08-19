import api from '@/api';

export type ScheduleLesson = {
	start_at: string;
	start_sound: string;
	end_at: string;
	end_sound: string;
};

export type SchedulePrecall = {
	sound_name: string;
	minutes_before: number;
};

export type ScheduleInfo = {
	id: number;
	name: string;
	lessons: ScheduleLesson[];
	precalls: SchedulePrecall[];
};

export type ScheduleCreateRequest = {
	name: string;
	lessons: ScheduleLesson[];
	precalls?: SchedulePrecall[];
};

export type ScheduleUpdateRequest = {
	name?: string;
	lessons?: ScheduleLesson[];
	precalls?: SchedulePrecall[];
};

export const getSchedules = async (): Promise<ScheduleInfo[]> =>
	(await api.get<ScheduleInfo[]>('school/schedules')).data;

export const createSchedule = async (
	req: ScheduleCreateRequest
): Promise<ScheduleInfo> =>
	(await api.post<ScheduleInfo>('school/schedules', req)).data;

export const updateSchedule = async (
	id: number,
	req: ScheduleUpdateRequest
): Promise<ScheduleInfo> =>
	(await api.patch<ScheduleInfo>(`school/schedules/${id}`, req)).data;

export const deleteSchedule = async (id: number): Promise<ScheduleInfo> =>
	(await api.delete<ScheduleInfo>(`school/schedules/${id}`)).data;

export const dupeSchedule = async (id: number): Promise<ScheduleInfo> =>
	(await api.post<ScheduleInfo>(`school/schedules/dupe/${id}`)).data;
