// @ts-nocheck
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, Spinner } from 'react-bootstrap';
import { Plus, PlayFill, Trash } from 'react-bootstrap-icons';
import {
	Automation,
	AutomationCreateRequest,
	createAutomation,
	deleteAutomation,
	getAutomations,
	runAutomation,
	updateAutomation
} from '@/api/school/automations';
import { useSounds } from '@/sounds';
import { cn } from '@/utils';
import PageLayout from '@/components/PageLayout';
import Panel from '@/components/Panel';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { Name, Note } from '@/components/text';
import TextProperty from '@/components/TextProperty';
import DangerConfirmModal from '@/components/DangerConfirmModal';
import Toast from '@/components/Toast';

// 0=пн … 6=вс, как на бэке
const WEEKDAY_NAMES = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

const sortWeekdays = (weekdays: number[]) =>
	Array.from(new Set(weekdays)).sort((a, b) => a - b);

/* ---------------- WeekdayPicker ---------------- */
const WeekdayPicker = ({
	weekdays,
	disabled,
	onChange
}: {
	weekdays: number[];
	disabled?: boolean;
	onChange: (weekdays: number[]) => void;
}) => {
	const toggle = (day: number) => {
		if (disabled) return;
		const has = weekdays.includes(day);
		if (has && weekdays.length <= 1) return; // минимум один день
		const next = has
			? weekdays.filter((d) => d !== day)
			: sortWeekdays([...weekdays, day]);
		onChange(next);
	};

	return (
		<div className='flex gap-1'>
			{WEEKDAY_NAMES.map((label, day) => {
				const active = weekdays.includes(day);
				return (
					<button
						key={day}
						type='button'
						disabled={disabled}
						onClick={() => toggle(day)}
						className={cn(
							'h-8 w-8 rounded-md text-xs font-semibold transition-colors',
							active
								? 'bg-blue-500 text-white'
								: 'bg-gray-200 text-gray-500 hover:bg-gray-300',
							disabled && 'opacity-50 pointer-events-none'
						)}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
};

/* ---------------- AutomationCard ---------------- */
const AutomationCard = ({
	automation,
	onDelete,
	onToast
}: {
	automation: Automation;
	onDelete: (automation: Automation) => void;
	onToast: (message: string, variant?: 'success' | 'warning') => void;
}) => {
	const queryClient = useQueryClient();
	const { soundNameList } = useSounds();

	const patchMutation = useMutation({
		mutationKey: ['school.automations.update', automation.id],
		mutationFn: (patch: Partial<Automation>) =>
			updateAutomation(automation.id, patch),
		onSuccess: (updated) => {
			queryClient.setQueryData<Automation[]>(
				['school.automations'],
				(prev) =>
					prev
						? prev.map((a) => (a.id === updated.id ? updated : a))
						: prev
			);
		},
		onError: () => onToast('Не удалось сохранить изменения', 'warning')
	});

	const runMutation = useMutation({
		mutationKey: ['school.automations.run', automation.id],
		mutationFn: () => runAutomation(automation.id),
		onSuccess: () => onToast(`«${automation.name}» запущена`),
		onError: () => onToast('Не удалось запустить автоматизацию', 'warning')
	});

	return (
		<Panel className='flex flex-col'>
			<Panel.Header className='flex items-center gap-3 p-3'>
				<Form.Check
					type='switch'
					id={`automation-enabled-${automation.id}`}
					className='my-auto scale-110'
					checked={automation.enabled}
					disabled={patchMutation.isPending}
					onChange={(e) => patchMutation.mutate({ enabled: e.target.checked })}
				/>

				<TextProperty
					value={automation.name}
					disabled={patchMutation.isPending}
					className='h-9 max-w-[16rem]'
					onSubmit={(v) => {
						if (v && v !== automation.name) patchMutation.mutate({ name: v });
					}}
				/>

				<div className='ml-auto flex items-center gap-2'>
					<button
						title='Запустить сейчас'
						disabled={runMutation.isPending}
						onClick={() => runMutation.mutate()}
						className='p-2 border-1 rounded-md border-gray-300 text-gray-500 hover:text-blue-500 hover:border-blue-500 disabled:opacity-50'
					>
						{runMutation.isPending ? (
							<Spinner size='sm' />
						) : (
							<PlayFill size='1rem' />
						)}
					</button>
					<button
						title='Удалить'
						onClick={() => onDelete(automation)}
						className='p-2 border-1 rounded-md border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-500'
					>
						<Trash size='1rem' />
					</button>
				</div>
			</Panel.Header>

			<div className='flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-blue-50'>
				<Field>
					<Name>Дни недели</Name>
					<WeekdayPicker
						weekdays={automation.weekdays}
						disabled={patchMutation.isPending}
						onChange={(weekdays) => patchMutation.mutate({ weekdays })}
					/>
				</Field>

				<Field>
					<Name>Время</Name>
					<input
						type='time'
						value={automation.at}
						disabled={patchMutation.isPending}
						onChange={(e) => patchMutation.mutate({ at: e.target.value })}
						className='px-2 py-1 border rounded border-gray-200'
					/>
				</Field>

				<Field className='sm:min-w-[12rem]'>
					<Name>Звук</Name>
					<Form.Select
						value={automation.sound_name}
						disabled={patchMutation.isPending}
						onChange={(e) => patchMutation.mutate({ sound_name: e.target.value })}
					>
						{!soundNameList.includes(automation.sound_name) && (
							<option value={automation.sound_name}>
								{automation.sound_name}
							</option>
						)}
						{soundNameList.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</Form.Select>
				</Field>
			</div>
		</Panel>
	);
};

/* ---------------- NewAutomationCard ---------------- */
const NewAutomationCard = ({
	onCancel,
	onCreate,
	isPending
}: {
	onCancel: () => void;
	onCreate: (req: AutomationCreateRequest) => void;
	isPending: boolean;
}) => {
	const { soundNameList } = useSounds();
	const today = (new Date().getDay() + 6) % 7;

	const [name, setName] = useState('');
	const [weekdays, setWeekdays] = useState<number[]>([today]);
	const [at, setAt] = useState('08:00');
	const [soundName, setSoundName] = useState('');

	const effectiveSound = soundName || soundNameList[0] || '';
	const canCreate = name.trim() !== '' && effectiveSound !== '' && weekdays.length > 0;

	return (
		<Panel className='flex flex-col rounded-lg border-2 border-blue-300'>
			<Panel.Header className='p-3'>
				<input
					autoFocus
					placeholder='Название автоматизации'
					value={name}
					onChange={(e) => setName(e.target.value)}
					className='w-full max-w-[20rem] px-2 py-1 border rounded border-gray-200'
				/>
			</Panel.Header>

			<div className='flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-blue-50'>
				<Field>
					<Name>Дни недели</Name>
					<WeekdayPicker weekdays={weekdays} onChange={setWeekdays} />
				</Field>

				<Field>
					<Name>Время</Name>
					<input
						type='time'
						value={at}
						onChange={(e) => setAt(e.target.value)}
						className='px-2 py-1 border rounded border-gray-200'
					/>
				</Field>

				<Field className='sm:min-w-[12rem]'>
					<Name>Звук</Name>
					<Form.Select
						value={effectiveSound}
						onChange={(e) => setSoundName(e.target.value)}
					>
						{soundNameList.length === 0 && <option value=''>нет звуков</option>}
						{soundNameList.map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</Form.Select>
				</Field>
			</div>

			<div className='border-t p-3 flex justify-end gap-2'>
				<Button variant='secondary' onClick={onCancel} disabled={isPending}>
					Отмена
				</Button>
				<Button
					disabled={!canCreate || isPending}
					onClick={() =>
						onCreate({
							name: name.trim(),
							sound_name: effectiveSound,
							at,
							weekdays: sortWeekdays(weekdays)
						})
					}
				>
					{isPending ? <Spinner size='sm' /> : <Plus size={20} />}
					Создать
				</Button>
			</div>
		</Panel>
	);
};

/* ---------------- AutomationsPage ---------------- */
const AutomationsPage = () => {
	const queryClient = useQueryClient();

	const automationsQuery = useQuery({
		queryFn: () => getAutomations(),
		queryKey: ['school.automations']
	});

	const [creating, setCreating] = useState(false);
	const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(
		null
	);

	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [toastVariant, setToastVariant] = useState<'success' | 'warning'>(
		'success'
	);

	const showPageToast = (
		message: string,
		variant: 'success' | 'warning' = 'success'
	) => {
		setToastMessage(message);
		setToastVariant(variant);
		setShowToast(true);
	};

	const createMutation = useMutation({
		mutationKey: ['school.automations.create'],
		mutationFn: (req: AutomationCreateRequest) => createAutomation(req),
		onSuccess: () => {
			setCreating(false);
			queryClient.invalidateQueries(['school.automations']);
		},
		onError: () => showPageToast('Не удалось создать автоматизацию', 'warning')
	});

	const deleteMutation = useMutation({
		mutationKey: ['school.automations.delete'],
		mutationFn: (id: number) => deleteAutomation(id),
		onSuccess: () => {
			setAutomationToDelete(null);
			queryClient.invalidateQueries(['school.automations']);
		},
		onError: () => showPageToast('Не удалось удалить автоматизацию', 'warning')
	});

	const automations = automationsQuery.data;

	return (
		<PageLayout pageTitle='Автоматизация' className='max-w-[52rem]'>
			<Toast
				show={showToast}
				setShow={setShowToast}
				message={toastMessage}
				variant={toastVariant}
				delay={4000}
			/>

			<div className='flex flex-col gap-4'>
				{automations
					? automations.map((automation) => (
							<AutomationCard
								key={automation.id}
								automation={automation}
								onDelete={setAutomationToDelete}
								onToast={showPageToast}
							/>
					  ))
					: 'Загрузка...'}

				{automations && automations.length === 0 && !creating && (
					<Note>Автоматизаций пока нет</Note>
				)}

				{creating ? (
					<NewAutomationCard
						isPending={createMutation.isPending}
						onCancel={() => setCreating(false)}
						onCreate={(req) => createMutation.mutate(req)}
					/>
				) : (
					<Button
						onClick={() => setCreating(true)}
						variant='secondary'
						className='w-full justify-center sm:w-auto sm:px-8'
					>
						<Plus size={24} /> Создать
					</Button>
				)}
			</div>

			<DangerConfirmModal
				show={automationToDelete !== null}
				title='Подтверждение удаления'
				description='Вы уверены, что хотите удалить автоматизацию?'
				details={
					automationToDelete ? (
						<p className='bg-gray-100 p-2 rounded-md font-mono text-sm'>
							автоматизация "{automationToDelete.name}"
						</p>
					) : null
				}
				warning={
					<p className='text-red-600 text-sm'>Это действие невозможно отменить.</p>
				}
				confirmText='Удалить автоматизацию'
				pendingText='Удаление...'
				onCancel={() => setAutomationToDelete(null)}
				onConfirm={() =>
					automationToDelete && deleteMutation.mutate(automationToDelete.id)
				}
				isPending={deleteMutation.isPending}
			/>
		</PageLayout>
	);
};

export default AutomationsPage;
