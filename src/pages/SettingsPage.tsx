// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import {
	ArrowClockwise,
	ArrowRepeat,
	Download,
	Power,
	Upload
} from 'react-bootstrap-icons';
import { useMutation } from '@tanstack/react-query';
import Button from '@/components/Button';
import { H2, Name, Note, Value } from '@/components/text';
import Panel from '@/components/Panel';
import Field from '@/components/Field';
import FileUploadButton from '@/components/FileUploadButton';
import Toast from '@/components/Toast';
import PageLayout from '@/components/PageLayout';
import UpdateSoftwareModal, {
	type UpdatePhase
} from '@/components/settings/UpdateSoftwareModal';
import DangerConfirmModal from '@/components/DangerConfirmModal';
import {
	checkSchoolUpdates,
	downloadSchoolCertificate,
	exportSchoolSettingsFile,
	getGpioSettings,
	getSchoolHealth,
	getSettingsVolume,
	type GpioSettingsPatch,
	type GpioState,
	importSchoolSettingsFile,
	rebootSchoolDevice,
	restartSchoolService,
	setSchoolVolume,
	updateGpioSettings,
	updateSchoolSoftware
} from '@/api/school/settings';

const HEALTH_POLL_INTERVAL_MS = 1000;
const HEALTH_TIMEOUT_MS = 180000;
const HEALTH_REQUEST_TIMEOUT_MS = 1500;

const GPIO_PIN_MIN = 0;
const GPIO_PIN_MAX = 53;
const GPIO_PIN_FALLBACK = 17;

const SettingsPage = () => {
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [toastVariant, setToastVariant] = useState<'success' | 'warning'>(
		'success'
	);
	const [showRebootConfirm, setShowRebootConfirm] = useState(false);
	const [showRestartConfirm, setShowRestartConfirm] = useState(false);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	const [updatePhase, setUpdatePhase] = useState<UpdatePhase>('confirm');
	const [updateErrorMessage, setUpdateErrorMessage] = useState('');

	const [isUpdatingVolume, setIsUpdatingVolume] = useState(false);
	const volumeRequestIdRef = useRef(0);
	const updateFlowRunIdRef = useRef(0);
	const updateFlowRunningRef = useRef(false);
	const isMountedRef = useRef(true);

	const [schoolSettings, setSchoolSettings] = useState({
		schedules: true,
		assignments: true,
		overrides: true,
		automations: true
	});

	const [deviceVolume, setDeviceVolume] = useState(65);

	const [isGpioLoaded, setIsGpioLoaded] = useState(false);
	const [relayEnabled, setRelayEnabled] = useState(false);
	const [relayPin, setRelayPin] = useState(GPIO_PIN_FALLBACK);
	const [relayPinInput, setRelayPinInput] = useState(String(GPIO_PIN_FALLBACK));

	const showPageToast = (
		message: string,
		variant: 'success' | 'warning' = 'success'
	) => {
		setToastMessage(message);
		setToastVariant(variant);
		setShowToast(true);
	};

	const resetUpdateFlowState = () => {
		setUpdatePhase('confirm');
		setUpdateErrorMessage('');
	};

	const closeUpdateModal = () => {
		if (
			updatePhase === 'running' ||
			updatePhase === 'restarting' ||
			updateFlowRunningRef.current
		) {
			return;
		}
		setShowUpdateModal(false);
		resetUpdateFlowState();
	};

	useEffect(() => {
		let isActive = true;

		const initVolume = async () => {
			try {
				const response = await getSettingsVolume();
				const volumeValue =
					typeof response?.volume === 'number'
						? response.volume
						: Number(response?.volume);
				if (isActive && !Number.isNaN(volumeValue)) {
					setDeviceVolume(volumeValue);
				}
			} catch {
				if (isActive) {
					showPageToast('Не удалось получить текущую громкость', 'warning');
				}
			}
		};

		initVolume();

		return () => {
			isActive = false;
		};
	}, []);

	const applyGpioState = (state: GpioState) => {
		setRelayEnabled(state.enabled === true);

		const pinValue = Number(state.pin);
		if (Number.isInteger(pinValue)) {
			setRelayPin(pinValue);
			setRelayPinInput(String(pinValue));
		}
	};

	useEffect(() => {
		let isActive = true;

		const initGpio = async () => {
			try {
				const state = await getGpioSettings();
				if (!isActive) {
					return;
				}
				applyGpioState(state);
				setIsGpioLoaded(true);
			} catch {
				if (isActive) {
					showPageToast('Не удалось получить настройки режима реле', 'warning');
				}
			}
		};

		initGpio();

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			updateFlowRunIdRef.current += 1;
			updateFlowRunningRef.current = false;
		};
	}, []);

	const settingsImportMutation = useMutation({
		mutationKey: ['settings.settings.import'],
		mutationFn: (file: File) => importSchoolSettingsFile(file),
		onSuccess: () => showPageToast('Импорт настроек выполнен'),
		onError: () =>
			showPageToast('Не удалось импортировать настройки школы', 'warning')
	});

	const settingsExportMutation = useMutation({
		mutationKey: ['settings.settings.export'],
		mutationFn: () => exportSchoolSettingsFile(schoolSettings),
		onSuccess: (fileBlob) => {
			const datePart = new Date().toISOString().slice(0, 10);
			const downloadUrl = URL.createObjectURL(fileBlob);
			const link = document.createElement('a');
			link.href = downloadUrl;
			link.download = `school-settings-${datePart}.json`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(downloadUrl);

			showPageToast('Экспорт настроек выполнен');
		},
		onError: () =>
			showPageToast('Не удалось экспортировать настройки школы', 'warning')
	});

	const volumeMutation = useMutation({
		mutationKey: ['settings.volume.update'],
		mutationFn: (volume: number) => setSchoolVolume(volume),
		onError: () =>
			showPageToast('Не удалось отправить значение громкости', 'warning')
	});

	const gpioMutation = useMutation({
		mutationKey: ['settings.gpio.update'],
		mutationFn: (patch: GpioSettingsPatch) => updateGpioSettings(patch),
		onSuccess: (state) => applyGpioState(state)
	});

	const certificateDownloadMutation = useMutation({
		mutationKey: ['settings.certs.download'],
		mutationFn: () => downloadSchoolCertificate(),
		onSuccess: ({ blob, fileName }) => {
			const downloadUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = downloadUrl;
			link.download = fileName || 'certificate.crt';
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(downloadUrl);

			showPageToast('Сертификат скачан');
		},
		onError: () => showPageToast('Не удалось скачать сертификат', 'warning')
	});

	const updateSoftwareMutation = useMutation({
		mutationKey: ['settings.update'],
		mutationFn: () => updateSchoolSoftware()
	});

	const checkUpdatesMutation = useMutation({
		mutationKey: ['settings.check_updates'],
		mutationFn: () => checkSchoolUpdates(),
		onSuccess: (data) => {
			const status = String(data?.status ?? '').toLowerCase();
			const hasUpdates =
				data?.has_updates === true ||
				data?.backend_has_updates === true ||
				data?.frontend_has_updates === true;

			if (status === 'up_to_date') {
				showPageToast('У вас последняя версия');
				return;
			}

			if (status === 'updates_available' || hasUpdates) {
				showPageToast('Доступны обновления', 'warning');
				resetUpdateFlowState();
				setShowUpdateModal(true);
				return;
			}

			showPageToast('Не удалось определить статус обновлений', 'warning');
		},
		onError: () => showPageToast('Не удалось запустить проверку обновлений', 'warning')
	});

	const isCurrentUpdateRun = (runId: number) =>
		isMountedRef.current && runId === updateFlowRunIdRef.current;

	const sleep = (delayMs: number) =>
		new Promise((resolve) => window.setTimeout(resolve, delayMs));

	const waitForHealthReady = async (
		runId: number,
		timeoutMs = HEALTH_TIMEOUT_MS,
		intervalMs = HEALTH_POLL_INTERVAL_MS
	) => {
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			if (!isCurrentUpdateRun(runId)) {
				return false;
			}

			try {
				const perRequestTimeoutMs = Math.min(
					HEALTH_REQUEST_TIMEOUT_MS,
					Math.max(250, deadline - Date.now())
				);
				await getSchoolHealth({ timeoutMs: perRequestTimeoutMs });
				return true;
			} catch {
				// Во время перезапуска сервис может быть временно недоступен.
			}

			const remainingMs = deadline - Date.now();
			if (remainingMs <= 0) {
				break;
			}
			await sleep(Math.min(intervalMs, remainingMs));
		}

		return false;
	};

	const normalizeUpdateResponse = (response: unknown) => {
		let normalizedResponse = response;

		if (typeof normalizedResponse === 'string') {
			try {
				normalizedResponse = JSON.parse(normalizedResponse);
			} catch {}
		}

		if (
			normalizedResponse &&
			typeof normalizedResponse === 'object' &&
			'data' in normalizedResponse
		) {
			return normalizedResponse.data;
		}

		return normalizedResponse;
	};

	const getExplicitUpdateError = (response: any) => {
		const status = String(response?.status ?? '').toLowerCase();
		const hasFailedStatus =
			status === 'error' || status === 'failed' || status === 'failure';
		const hasFailedFlag =
			response?.ok === false || String(response?.ok).toLowerCase() === 'false';

		if (!hasFailedStatus && !hasFailedFlag) {
			return '';
		}

		const detailMessage =
			typeof response?.detail === 'string' ? response.detail.trim() : '';

		return detailMessage || 'Обновление не было применено. Попробуйте еще раз.';
	};

	const startUpdateFlow = async () => {
		if (updateFlowRunningRef.current) {
			return;
		}
		updateFlowRunningRef.current = true;

		const runId = updateFlowRunIdRef.current + 1;
		updateFlowRunIdRef.current = runId;

		setUpdateErrorMessage('');
		setUpdatePhase('running');

		try {
			const updateResponse = await updateSoftwareMutation.mutateAsync();

			if (!isCurrentUpdateRun(runId)) {
				return;
			}

			const normalizedResponse = normalizeUpdateResponse(updateResponse);
			const explicitError = getExplicitUpdateError(normalizedResponse);
			if (explicitError) {
				setUpdateErrorMessage(explicitError);
				setUpdatePhase('error');
				return;
			}

			const isBackendUpdated = normalizedResponse?.backend_updated === true;

			if (!isBackendUpdated) {
				// Сервис не перезапускается, обновление уже применено.
				setUpdatePhase('success');
				return;
			}

			setUpdatePhase('restarting');

			const isHealthReady = await waitForHealthReady(runId);
			if (!isCurrentUpdateRun(runId)) {
				return;
			}

			if (!isHealthReady) {
				setUpdateErrorMessage(
					'Система еще запускается, попробуйте проверить позже.'
				);
				setUpdatePhase('error');
				return;
			}

			setUpdatePhase('success');
		} catch (error) {
			if (!isCurrentUpdateRun(runId)) {
				return;
			}
			setUpdateErrorMessage(
				'Не удалось установить обновление. Проверьте соединение и попробуйте снова.'
			);
			setUpdatePhase('error');
		} finally {
			if (isCurrentUpdateRun(runId)) {
				updateFlowRunningRef.current = false;
			}
		}
	};

	const rebootMutation = useMutation({
		mutationKey: ['settings.reboot'],
		mutationFn: () => rebootSchoolDevice(),
		onSuccess: () => {
			setShowRebootConfirm(false);
			showPageToast('Команда перезагрузки отправлена. Сервер может быть недоступен в течение нескольких минут.', 'warning');
		},
		onError: () => showPageToast('Не удалось отправить команду перезагрузки', 'warning')
	});

	const restartServiceMutation = useMutation({
		mutationKey: ['settings.restart'],
		mutationFn: () => restartSchoolService(),
		onSuccess: () => {
			setShowRestartConfirm(false);
			showPageToast('Команда перезапуска сервиса отправлена. Сервис может быть недоступен в течение минуты.', 'warning');
		},
		onError: () => showPageToast('Не удалось отправить команду перезапуска сервиса', 'warning')
	});

	const handleVolumeChange = (value: number) => {
		setDeviceVolume(value);
		const requestId = ++volumeRequestIdRef.current;
		setIsUpdatingVolume(true);
		volumeMutation.mutate(value, {
			onSettled: () => {
				if (requestId === volumeRequestIdRef.current) {
					setIsUpdatingVolume(false);
				}
			}
		});
	};

	const handleRelayEnabledChange = (enabled: boolean) => {
		const previousEnabled = relayEnabled;
		setRelayEnabled(enabled);

		gpioMutation.mutate(
			{ enabled },
			{
				onError: () => {
					setRelayEnabled(previousEnabled);
					showPageToast('Не удалось изменить режим реле', 'warning');
				}
			}
		);
	};

	const commitRelayPin = () => {
		const rawValue = relayPinInput.trim();
		const pinValue = Number(rawValue);
		const isValidPin =
			rawValue !== '' &&
			Number.isInteger(pinValue) &&
			pinValue >= GPIO_PIN_MIN &&
			pinValue <= GPIO_PIN_MAX;

		if (!isValidPin) {
			setRelayPinInput(String(relayPin));
			showPageToast(
				`Пин GPIO должен быть целым числом от ${GPIO_PIN_MIN} до ${GPIO_PIN_MAX}`,
				'warning'
			);
			return;
		}

		if (pinValue === relayPin) {
			setRelayPinInput(String(relayPin));
			return;
		}

		const previousPin = relayPin;
		setRelayPin(pinValue);
		setRelayPinInput(String(pinValue));

		gpioMutation.mutate(
			{ pin: pinValue },
			{
				onError: () => {
					setRelayPin(previousPin);
					setRelayPinInput(String(previousPin));
					showPageToast('Не удалось сохранить пин GPIO', 'warning');
				}
			}
		);
	};

	return (
		<PageLayout pageTitle='Настройки' className='max-w-[36rem]'>
			<Toast
				show={showToast}
				setShow={setShowToast}
				message={toastMessage}
				variant={toastVariant}
				delay={4500}
			/>

			<div className='flex flex-col gap-4'>
				<Panel className='w-full'>
					<Panel.Header>
						<H2>Экспорт и импорт настроек</H2>
					</Panel.Header>
					<Panel.Body className='flex flex-col gap-4'>
						<Field>
							<Name>Что включить</Name>
							<Value className='flex flex-col gap-2'>
								<label className='flex items-center gap-2 text-sm font-normal'>
									<input
										type='checkbox'
										checked={schoolSettings.schedules}
										onChange={(e) =>
											setSchoolSettings((prev) => ({
												...prev,
												schedules: e.target.checked
											}))
										}
									/>
									Расписания
								</label>
								<label className='flex items-center gap-2 text-sm font-normal'>
									<input
										type='checkbox'
										checked={schoolSettings.assignments}
										onChange={(e) =>
											setSchoolSettings((prev) => ({
												...prev,
												assignments: e.target.checked
											}))
										}
									/>
									Назначения
								</label>
								<label className='flex items-center gap-2 text-sm font-normal'>
									<input
										type='checkbox'
										checked={schoolSettings.overrides}
										onChange={(e) =>
											setSchoolSettings((prev) => ({
												...prev,
												overrides: e.target.checked
											}))
										}
									/>
									Переопределения
								</label>
								<label className='flex items-center gap-2 text-sm font-normal'>
									<input
										type='checkbox'
										checked={schoolSettings.automations}
										onChange={(e) =>
											setSchoolSettings((prev) => ({
												...prev,
												automations: e.target.checked
											}))
										}
									/>
									Автоматизации
								</label>
							</Value>
						</Field>

						<div className='flex items-start gap-3'>
							<FileUploadButton
								className='w-full py-2 h-9 flex items-center justify-center gap-2'
								variant='success'
								handleFile={(file) => settingsImportMutation.mutate(file)}
								disabled={
									settingsImportMutation.isPending || settingsExportMutation.isPending
								}
								input={{ accept: '.json,application/json' }}
							>
								{settingsImportMutation.isPending ? (
									<Spinner animation='border' size='sm' />
								) : (
									<Download className='w-4 h-4 shrink-0' />
								)}
								{settingsImportMutation.isPending ? 'Импорт...' : 'Импорт'}
							</FileUploadButton>

							<Button
								className='w-full py-2 h-9 flex items-center justify-center gap-2'
								variant='primary'
								onClick={() => settingsExportMutation.mutate()}
								disabled={
									settingsExportMutation.isPending || settingsImportMutation.isPending
								}
							>
								{settingsExportMutation.isPending ? (
									<Spinner animation='border' size='sm' />
								) : (
									<Upload className='w-4 h-4' />
								)}
								{settingsExportMutation.isPending ? 'Экспорт...' : 'Экспорт'}
							</Button>
						</div>
					</Panel.Body>
				</Panel>

				<Panel className='w-full'>
					<Panel.Header>
						<H2>Устройство</H2>
					</Panel.Header>
					<Panel.Body className='flex flex-col gap-4'>
						<Field>
							<Name>Громкость устройства</Name>
							<Value className='space-y-2'>
								<input
									type='range'
									min={0}
									max={100}
									step={1}
									value={deviceVolume}
									onChange={(e) => handleVolumeChange(Number(e.target.value))}
									className='w-full'
								/>
								<Note>
									{deviceVolume}%{isUpdatingVolume ? ' (сохранение...)' : ''}
								</Note>
							</Value>
						</Field>

						<Field className='border-t pt-4 gap-3'>
							<div className='flex items-center gap-3'>
								<Form.Check
									type='switch'
									id='settings-relay-mode'
									className='my-auto scale-110'
									disabled={!isGpioLoaded || gpioMutation.isPending}
									checked={relayEnabled}
									onChange={(e) => handleRelayEnabledChange(e.target.checked)}
								/>
								<Name className='text-sm'>Режим реле</Name>
							</div>

							{relayEnabled && (
								<Value className='space-y-2'>
									<Name>Пин GPIO</Name>
									<input
										type='number'
										min={GPIO_PIN_MIN}
										max={GPIO_PIN_MAX}
										step={1}
										value={relayPinInput}
										disabled={!isGpioLoaded}
										onChange={(e) => setRelayPinInput(e.target.value)}
										onBlur={() => commitRelayPin()}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.currentTarget.blur();
											} else if (e.key === 'Escape') {
												setRelayPinInput(String(relayPin));
												e.currentTarget.blur();
											}
										}}
										className='w-full rounded-lg border-2 bg-gray-50 p-2 text-base'
									/>
									<Note>
										Допустимые значения: {GPIO_PIN_MIN}–{GPIO_PIN_MAX}.
									</Note>
								</Value>
							)}
						</Field>
					</Panel.Body>
				</Panel>

				<Panel className='w-full'>
					<Panel.Header>
						<H2>Обслуживание</H2>
					</Panel.Header>
					<Panel.Body className='flex flex-col gap-3'>
						<Button
							variant='primary'
							className='w-full'
							onClick={() => checkUpdatesMutation.mutate()}
							disabled={checkUpdatesMutation.isPending}
						>
							{checkUpdatesMutation.isPending ? (
								<Spinner animation='border' size='sm' />
							) : (
								<ArrowClockwise />
							)}
							Проверить обновления
						</Button>

						<Button
							variant='success'
							className='w-full'
							onClick={() => certificateDownloadMutation.mutate()}
							disabled={certificateDownloadMutation.isPending}
						>
							<Download />
							Скачать сертификат
						</Button>
						<Note>
							Чтобы убрать предупреждение о самоподписанном сертификате -
							скачайте сертификат по кнопке выше и доверьтесь ему.
						</Note>
					</Panel.Body>
				</Panel>

				<Panel className='w-full border-red-200'>
					<Panel.Header>
						<H2 className='text-red-600'>Опасная зона</H2>
					</Panel.Header>
					<Panel.Body className='flex flex-col gap-3'>
						<Button
							variant='danger'
							className='w-full'
							onClick={() => setShowRebootConfirm(true)}
							disabled={rebootMutation.isPending}
						>
							<Power />
							Перезагрузить сервер
						</Button>
						<Button
							variant='danger'
							className='w-full'
							onClick={() => setShowRestartConfirm(true)}
							disabled={restartServiceMutation.isPending}
						>
							<ArrowRepeat />
							Рестарт сервиса
						</Button>
					</Panel.Body>
				</Panel>
			</div>

			<DangerConfirmModal
				show={showRebootConfirm}
				title='Подтверждение перезагрузки'
				description='Вы действительно хотите перезагрузить сервер?'
				warning={
					<p className='text-red-600 text-sm'>
						Во время перезагрузки воспроизведение и управление будут временно
						недоступны.
					</p>
				}
				confirmText='Подтвердить перезагрузку'
				pendingText='Отправка...'
				onCancel={() => setShowRebootConfirm(false)}
				onConfirm={() => rebootMutation.mutate()}
				isPending={rebootMutation.isPending}
			/>
			<DangerConfirmModal
				show={showRestartConfirm}
				title='Подтверждение перезапуска'
				description='Вы действительно хотите перезапустить сервис?'
				warning={
					<p className='text-red-600 text-sm'>
						Во время перезапуска воспроизведение и управление будут временно
						недоступны.
					</p>
				}
				confirmText='Подтвердить перезапуск'
				pendingText='Отправка...'
				onCancel={() => setShowRestartConfirm(false)}
				onConfirm={() => restartServiceMutation.mutate()}
				isPending={restartServiceMutation.isPending}
			/>
			<UpdateSoftwareModal
				show={showUpdateModal}
				phase={updatePhase}
				errorMessage={updateErrorMessage}
				onClose={closeUpdateModal}
				onConfirm={startUpdateFlow}
				onRetry={startUpdateFlow}
			/>
		</PageLayout>
	);
};

export default SettingsPage;
