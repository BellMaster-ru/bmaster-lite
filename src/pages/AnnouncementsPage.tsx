import { useEffect, useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { Mic, StopCircle } from 'react-bootstrap-icons';
import { WS_BASE_URL } from '@/api';
import { H2, Note } from '@/components/text';
import Panel from '@/components/Panel';
import PageLayout from '@/components/PageLayout';
import { formatDurationMSS } from '@/utils';

const RATE = 48000;
const CHANNELS = 1;
const TIMESLICE_MS = 250;

interface Connection {
	ws: WebSocket;
	mediaRecorder: MediaRecorder;
	stream: MediaStream;
	mimeType: string;
	timesliceMs: number;
	seq: number;
	sampleRateHint: number;
	channelsHint: number;
}

type BroadcastStatus = 'idle' | 'connecting' | 'waiting' | 'started' | 'error';

interface WsServerMessage {
	type: 'error' | 'started' | 'stopped' | 'waiting' | string;
	error?: string;
}

interface WsStartMessage {
	type: 'start';
	icom: string;
	priority: number;
	force: boolean;
	codec: string;
	container: string;
	mime_type: string;
	timeslice_ms: number;
	sample_rate_hint: number;
	channels_hint: number;
}

const OPUS_MIME = 'audio/webm;codecs=opus';
const supportsMediaRecorder = (): boolean => {
	return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
};

const chooseMimeType = (): string | null => {
	if (!supportsMediaRecorder()) return null;
	return MediaRecorder.isTypeSupported(OPUS_MIME) ? OPUS_MIME : null;
};

const stopRecorder = async (mediaRecorder: MediaRecorder): Promise<void> => {
	if (mediaRecorder.state === 'inactive') return;
	await new Promise<void>((resolve) => {
		const onStop = () => resolve();
		mediaRecorder.addEventListener('stop', onStop, { once: true });
		mediaRecorder.stop();
	});
};

export default function AnnouncementsPage() {
	const [connection, setConnection] = useState<Connection | null>(null);
	const [status, setStatus] = useState<BroadcastStatus>('idle');
	const [error, setError] = useState<string | null>(null);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const connectionRef = useRef<Connection | null>(null);
	const isStoppingRef = useRef(false);

	const blocked = status === 'connecting';

	useEffect(() => {
		connectionRef.current = connection;
	}, [connection]);

	// счётчик длительности текущего эфира
	useEffect(() => {
		if (status !== 'started') {
			setElapsedSeconds(0);
			return;
		}
		const startedAt = Date.now();
		setElapsedSeconds(0);
		const interval = window.setInterval(() => {
			setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
		}, 1000);
		return () => window.clearInterval(interval);
	}, [status]);

	const stop = async (
		options: { closeSocket?: boolean; nextStatus?: BroadcastStatus } = {}
	) => {
		const { closeSocket = true, nextStatus = 'idle' } = options;
		const conn = connectionRef.current;
		if (!conn) return;

		isStoppingRef.current = true;
		setStatus(nextStatus);

		try {
			await stopRecorder(conn.mediaRecorder);
		} catch {}
		try {
			if (closeSocket && conn.ws.readyState === WebSocket.OPEN) {
				conn.ws.send(JSON.stringify({ type: 'stop' }));
			}
		} catch {}
		try {
			conn.stream.getTracks().forEach((track) => track.stop());
		} catch {}
		if (
			closeSocket &&
			(conn.ws.readyState === WebSocket.OPEN ||
				conn.ws.readyState === WebSocket.CONNECTING)
		) {
			try {
				conn.ws.close();
			} catch {}
		}

		connectionRef.current = null;
		setConnection(null);
		isStoppingRef.current = false;
	};

	useEffect(() => {
		if (!connection) return;

		const { ws } = connection;

		const wsOpen = () => {
			console.log('[WS] Opened');
			const startMessage: WsStartMessage = {
				type: 'start',
				icom: 'main',
				priority: 4,
				force: true,
				codec: 'opus',
				container: 'webm',
				mime_type: connection.mimeType,
				timeslice_ms: connection.timesliceMs,
				sample_rate_hint: connection.sampleRateHint,
				channels_hint: connection.channelsHint
			};
			ws.send(
				JSON.stringify(startMessage)
			);
		};

		const wsError = (e: Event) => {
			console.error('[WS] Error:', e);
			setError('Ошибка WebSocket-соединения');
			stop({ closeSocket: false, nextStatus: 'error' });
		};

		const wsMessage = (e: MessageEvent) => {
			const data = e.data;
			console.log('[WS] Message:', data);
			let msg: WsServerMessage | null = null;
			try {
				msg = JSON.parse(String(data)) as WsServerMessage;
			} catch {
				return;
			}

			switch (msg.type) {
				case 'error':
					setError(msg.error || 'Ошибка эфира');
					stop({ closeSocket: false, nextStatus: 'error' });
					break;
				case 'started':
					setStatus('started');
					if (connection.mediaRecorder.state === 'inactive') {
						connection.mediaRecorder.start(connection.timesliceMs);
					}
					break;
				case 'stopped':
					setStatus('waiting');
					break;
				case 'waiting':
					setStatus('waiting');
					break;
			}
		};

		const wsClose = () => {
			console.log('[WS] Closed');
			if (!isStoppingRef.current && connectionRef.current) {
				stop({ closeSocket: false, nextStatus: 'idle' });
			}
		};

		if (ws.readyState === WebSocket.OPEN) {
			wsOpen();
		} else ws.addEventListener('open', wsOpen);

		ws.addEventListener('error', wsError);
		ws.addEventListener('message', wsMessage);
		ws.addEventListener('close', wsClose);

		return () => {
			ws.removeEventListener('open', wsOpen);
			ws.removeEventListener('error', wsError);
			ws.removeEventListener('message', wsMessage);
			ws.removeEventListener('close', wsClose);
		};
	}, [connection]);

	const start = async () => {
		setError(null);
		const token = localStorage.getItem('bmaster.auth.token');
		if (!token) {
			setError('Требуется авторизация');
			setStatus('error');
			return;
		}
		const mimeType = chooseMimeType();
		if (!mimeType) {
			setError('Opus/WebM не поддерживается в этом браузере');
			setStatus('error');
			return;
		}

		let ws: WebSocket | null = null;
		let stream: MediaStream | null = null;
		let mediaRecorder: MediaRecorder | null = null;

		try {
			setStatus('connecting');
			const wsUrl = `${WS_BASE_URL}/api/queries/stream?token=${encodeURIComponent(token)}`;
			ws = new WebSocket(wsUrl);
			ws.binaryType = 'arraybuffer';

			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: RATE,
					channelCount: CHANNELS
				},
				video: false
			});

			mediaRecorder = new MediaRecorder(stream, {
				mimeType
			});
			const sampleRateHint = stream.getAudioTracks()[0]?.getSettings().sampleRate ?? RATE;
			const channelsHint = stream.getAudioTracks()[0]?.getSettings().channelCount ?? CHANNELS;
			mediaRecorder.addEventListener('dataavailable', async (event: BlobEvent) => {
				if (!connectionRef.current) return;
				if (event.data.size === 0) return;
				const activeConnection = connectionRef.current;
				if (activeConnection.ws.readyState !== WebSocket.OPEN) return;
				const arrayBuffer = await event.data.arrayBuffer();
				activeConnection.ws.send(arrayBuffer);
				activeConnection.seq += 1;
			});

			mediaRecorder.addEventListener('error', () => {
				setError('Ошибка кодирования аудио');
				stop({ closeSocket: true, nextStatus: 'error' });
			});

			setConnection({
				mediaRecorder,
				stream,
				mimeType,
				timesliceMs: TIMESLICE_MS,
				seq: 0,
				ws,
				sampleRateHint,
				channelsHint
			});
		} catch (e: unknown) {
			console.error('[Broadcast] Failed to start:', e);
			setError(e instanceof Error ? e.message : 'Не удалось начать эфир');
			setStatus('error');

			try {
				if (mediaRecorder) await stopRecorder(mediaRecorder);
			} catch {}
			try {
				stream?.getTracks().forEach((track) => track.stop());
			} catch {}
			if (
				ws &&
				(ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
			) {
				try {
					ws.close();
				} catch {}
			}
		}
	};

	const handleClick = () => {
		if (status === 'idle' || status === 'error') {
			start();
		} else {
			stop();
		}
	};

	const statusLabel =
		status === 'idle'
			? 'Готов'
			: status === 'connecting'
			? 'Подключение...'
			: status === 'waiting'
			? 'Ожидание'
			: status === 'started'
			? 'Говорите'
			: 'Ошибка';

	const statusBadgeClass = () => {
		switch (status) {
			case 'started':
				return 'bg-emerald-50 text-emerald-700';
			case 'connecting':
				return 'bg-amber-50 text-amber-700';
			case 'waiting':
				return 'bg-sky-50 text-sky-700';
			case 'error':
				return 'bg-red-50 text-red-700';
			default:
				return 'bg-slate-50 text-slate-700';
		}
	};

	return (
		<PageLayout pageTitle='Объявления' className='max-w-md'>
			<Panel>
				<Panel.Header className='flex flex-col gap-1'>
					<H2>Прямой эфир</H2>
					<Note>Голос прозвучит в колонках школы</Note>
				</Panel.Header>
				<Panel.Body className='bg-white flex flex-col items-center gap-6 py-12'>
					{/* декоративные кольца (только во время эфира) + большая кнопка */}
					<div
						className='relative flex items-center justify-center'
						style={{ width: 260, height: 260 }}
					>
						{status === 'started' &&
							[0, 1, 2].map((ring) => (
								<span
									key={ring}
									className='absolute rounded-full border-2 border-rose-300 sound-wave'
									style={{
										width: 150,
										height: 150,
										left: '50%',
										top: '50%',
										marginLeft: -75,
										marginTop: -75,
										animationDelay: `${ring * 0.6}s`
									}}
								/>
							))}

						<button
							aria-pressed={status === 'started'}
							aria-label={status === 'idle' ? 'Начать эфир' : 'Остановить эфир'}
							disabled={blocked}
							onClick={handleClick}
							className={`relative flex items-center justify-center rounded-full transform transition-transform active:scale-95 focus:outline-none ring-0 shadow-md
                ${
									status === 'started'
										? 'bg-rose-600 hover:bg-rose-700'
										: 'bg-blue-600 hover:bg-blue-700'
								}
                text-white`}
							style={{ width: 140, height: 140 }}
						>
							{/* subtle inner circle */}
							<span
								className={`absolute rounded-full inset-0 ${
									status === 'started'
										? 'opacity-10 bg-rose-600'
										: 'bg-blue-500 hover:bg-blue-400'
								}`}
							/>

							<div className='relative z-10 flex items-center justify-center'>
								{status === 'connecting' && <Spinner style={{ width: 44, height: 44 }} />}
								{status === 'idle' && <Mic size={44} />}
								{status === 'started' && <StopCircle size={44} />}
								{status === 'waiting' && <Mic size={44} />}
								{status === 'error' && <StopCircle size={44} />}
							</div>
						</button>
					</div>

					<div className='flex flex-col items-center gap-2'>
						<div className='flex flex-col sm:flex-row items-center gap-3'>
							<div
								className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass()}`}
							>
								{statusLabel}
							</div>
							{status === 'started' && (
								<div className='font-mono text-sm text-slate-500'>
									{formatDurationMSS(elapsedSeconds)}
								</div>
							)}
						</div>
						{error && <div className='text-sm text-red-600'>{error}</div>}
					</div>
				</Panel.Body>
			</Panel>

			<style>{`
        /* расходящиеся кольца вокруг кнопки во время эфира: 2с волна + 2.5с пауза */
        @keyframes soundWave {
          0% { transform: scale(1); opacity: 0.5; }
          44.4% { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .sound-wave {
          animation: soundWave 4.5s ease-out infinite;
        }
        /* accessible focus ring */
        button:focus { box-shadow: 0 0 0 6px rgba(37,99,235,0.12); }
        @media (prefers-reduced-motion: reduce) {
          .sound-wave, .animate-spin { animation: none !important; }
        }
      `}</style>
		</PageLayout>
	);
}
