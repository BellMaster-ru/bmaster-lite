// @ts-nocheck
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { Card, Offcanvas, Spinner } from 'react-bootstrap';
import {
	Bell,
	BellFill,
	CalendarDate,
	ChevronLeft,
	ChevronRight,
	DoorOpen,
	Gear,
	List,
	Mic,
	MusicNoteList,
	Person,
	PersonCircle,
	PlayFill,
	Repeat,
	Wrench,
} from 'react-bootstrap-icons';
import { useQuery } from '@tanstack/react-query';
import { AccountLocalInfo, getLocalUser } from '@/api/auth';
import Clock from './components/Clock';
import { LocalUserProvider } from '@/contexts/LocalUserContext';

import AnnouncementsPage from '@/pages/AnnouncementsPage';
import SoundsPage from '@/pages/SoundsPage';
import CalendarPage from '@/pages/school/CalendarPage';
import SchedulesPage from '@/pages/school/SchedulesPage';
import AutomationsPage from '@/pages/school/AutomationsPage';

import TodayPage from '@/pages/school/TodayPage';
import DraggableCard from '@/components/DraggableCard';
import * as icoms from '@/api/icoms';
import { IcomQuery } from '@/pages/icoms/queries';
import SettingsPage from './pages/SettingsPage';
import { H2, Note } from './components/text';
import Button from './components/Button';
import Foreground from './components/Foreground';
import Panel from './components/Panel';
import AccountsPage from './pages/access/AccountsPage';
import { cn } from './utils';
import { useEffect, useState } from 'react';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'bmaster.ui.sidebar.collapsed';

type SidebarNavLinksProps = {
	collapsed?: boolean;
	onNavigate?: () => void;
};

const SidebarNavLinks = ({
	collapsed = false,
	onNavigate
}: SidebarNavLinksProps) => {
	const getLinkClassName = ({ isActive }: { isActive: boolean }) =>
		cn(
			'group flex items-center rounded-xl px-3.5 py-3 text-base font-semibold transition-colors',
			collapsed ? 'justify-center' : 'gap-3',
			isActive
				? 'bg-blue-100 text-blue-700'
				: 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
		);

	return (
		<nav className='flex flex-col gap-1'>
			<NavLink to='/school/today' className={getLinkClassName} onClick={onNavigate}>
				<Bell size='1.25rem' />
				{!collapsed && <span>Сегодня</span>}
			</NavLink>
			<NavLink
				to='/school/schedules'
				className={getLinkClassName}
				onClick={onNavigate}
			>
				<List size='1.25rem' />
				{!collapsed && <span>Расписания</span>}
			</NavLink>
			<NavLink
				to='/school/calendar'
				className={getLinkClassName}
				onClick={onNavigate}
			>
				<CalendarDate size='1.25rem' />
				{!collapsed && <span>Календарь</span>}
			</NavLink>
			<NavLink
				to='/school/automations'
				className={getLinkClassName}
				onClick={onNavigate}
			>
				<Repeat size='1.25rem' />
				{!collapsed && <span>Автоматизация</span>}
			</NavLink>
			<NavLink
				to='/announcements'
				className={getLinkClassName}
				onClick={onNavigate}
			>
				<Mic size='1.25rem' />
				{!collapsed && <span>Объявления</span>}
			</NavLink>
			<NavLink to='/sounds' className={getLinkClassName} onClick={onNavigate}>
				<MusicNoteList size='1.25rem' />
				{!collapsed && <span>Звуки</span>}
			</NavLink>
			<NavLink to='/settings' className={getLinkClassName} onClick={onNavigate}>
				<Gear size='1.25rem' />
				{!collapsed && <span>Настройки</span>}
			</NavLink>
			<NavLink to='/accounts' className={getLinkClassName} onClick={onNavigate}>
				<Person size='1.25rem' />
				{!collapsed && <span>Пользователи</span>}
			</NavLink>
		</nav>
	);
};

export default function MainPage() {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

	const {
		data: localUser,
		isLoading,
		isError
	} = useQuery({
		queryFn: () => getLocalUser(),
		queryKey: ['localUser'],
		retry: (failureCount) => failureCount < 2
	});

	const mainIcomQuery = useQuery({
		queryFn: () => icoms.getIcom('main'),
		queryKey: ['icoms'],
		refetchInterval: 2000
	});

	useEffect(() => {
		const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
		if (raw === 'true') setIsSidebarCollapsed(true);
		if (raw === 'false') setIsSidebarCollapsed(false);
	}, []);

	useEffect(() => {
		localStorage.setItem(
			SIDEBAR_COLLAPSED_STORAGE_KEY,
			String(isSidebarCollapsed)
		);
	}, [isSidebarCollapsed]);

	const handleLogout = () => {
		localStorage.removeItem('bmaster.auth.token');
		window.location.href = '/';
	};

	if (isLoading)
		return (
			<>
				<Foreground>
					<Panel>
						<Panel.Header>Авторизация</Panel.Header>
						<Panel.Body className='space-y-4'>
							<Note className='text-slate-600'>Входим в систему…</Note>
						</Panel.Body>
					</Panel>
				</Foreground>
			</>
		);
	else if (isError || !localUser)
		return (
			<>
				<Foreground>
					<Panel>
						<Panel.Header>
							<H2>Ошибка авторизации</H2>
						</Panel.Header>
						<Panel.Body className='space-y-4'>
							<Note className='text-slate-600'>
								Произошла ошибка авторизации. Пожалуйста, выйдите с помощью
								кнопки ниже и войдите снова.
							</Note>
							<Button variant='primary' onClick={handleLogout}>
								Выйти
							</Button>
						</Panel.Body>
					</Panel>
				</Foreground>
			</>
		);

	const mainIcom = mainIcomQuery.data;

	let profile;
	let profileIcon;
	let profileLabel = '';
	switch (localUser.type) {
		case 'account':
			const account = localUser as AccountLocalInfo;
			profileIcon = <PersonCircle size='1.1rem' />;
			profileLabel = account.name;
			profile = (
				<>
					{profileIcon}
					<span>{account.name}</span>
				</>
			);
			break;
		case 'root':
			profileIcon = <Wrench size='1.1rem' />;
			profileLabel = 'Администратор';
			profile = (
				<>
					{profileIcon}
					<span>Администратор</span>
				</>
			);
			break;
	}

	return (
			<LocalUserProvider localUser={localUser}>
				<div className='flex relative w-screen h-screen bg-slate-100'>
				<aside
					className={cn(
						'hidden md:flex h-screen shrink-0 flex-col border-r border-slate-200 bg-[#F1F5F9] transition-all duration-300',
						isSidebarCollapsed ? 'w-20' : 'w-64'
					)}
				>
					<div className='flex items-center justify-between gap-2 border-b  border-slate-200 px-3 py-3'>
						<Link
							to='/'
							className={cn(
								'flex items-center gap-2 font-semibold text-slate-700',
								isSidebarCollapsed && 'mx-auto'
							)}
						>
							<BellFill className='origin-top hover:animate-ring' />
							{!isSidebarCollapsed && <span className='text-2xl'>BMaster</span>}
						</Link>
						<button
							type='button'
							onClick={() => setIsSidebarCollapsed((prev) => !prev)}
							className='rounded-lg p-2 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
							aria-label={
								isSidebarCollapsed
									? 'Развернуть боковое меню'
									: 'Свернуть боковое меню'
							}
						>
							{isSidebarCollapsed ? (
								<ChevronRight size='1rem' />
							) : (
								<ChevronLeft size='1rem' />
							)}
						</button>
					</div>
					<div className='flex-1 overflow-y-auto p-3'>
						<SidebarNavLinks collapsed={isSidebarCollapsed} />
					</div>
					<div className='border-t border-slate-200 p-3'>
						{isSidebarCollapsed ? (
							<div className='flex flex-col items-center gap-2 text-slate-700'>
								<div
									className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-200'
									title={profileLabel}
								>
									{profileIcon}
								</div>
								<button
									type='button'
									className='flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200/80'
									onClick={handleLogout}
									title='Выйти'
								>
									<DoorOpen size='1.1rem' />
								</button>
							</div>
						) : (
							<div className='space-y-2 text-sm text-slate-700'>
								<div className='flex items-center gap-2 rounded-lg bg-slate-200/70 px-3 py-2'>
									{profileIcon}
									<span className='truncate'>{profileLabel}</span>
								</div>
								<button
									type='button'
									className='flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-200/80'
									onClick={handleLogout}
								>
									<DoorOpen size='1.1rem' />
									<span>Выйти</span>
								</button>
							</div>
						)}
					</div>
				</aside>

					<div className='flex min-w-0 flex-1 flex-col h-screen'>
						<header className='flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F1F5F9] px-3 py-2 md:px-5'>
							<div className='flex items-center gap-2'>
								<button
									type='button'
									className='flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200/80 md:hidden'
									onClick={() => setIsMobileNavOpen(true)}
									aria-label='Открыть меню'
								>
									<List size='1.35rem' />
								</button>
								<Link
									to='/'
									className='flex items-center gap-2 text-xl font-bold text-slate-700 md:hidden'
								>
									<BellFill size='1.3rem' className='origin-top hover:animate-ring' />
									<span>BMaster</span>
								</Link>
							</div>
							<Clock />
						</header>

						<main className='flex-1 py-4 overflow-y-auto'>
							<Routes>
							<Route path='/' element={<TodayPage />} />
							<Route path='/school/today' element={<TodayPage />} />
							<Route path='/school/schedules' element={<SchedulesPage />} />
							<Route path='/school/calendar' element={<CalendarPage />} />
							<Route path='/school/automations' element={<AutomationsPage />} />
							<Route path='/announcements' element={<AnnouncementsPage />} />
							<Route path='/sounds' element={<SoundsPage />} />
							<Route path='/settings' element={<SettingsPage />} />
							<Route path='/accounts' element={<AccountsPage />} />
						</Routes>
					</main>

					<footer className='flex h-11 shrink-0 items-center border-t border-slate-200 bg-slate-200/80 px-4 text-xs font-semibold tracking-wide text-slate-600'>
						BMaster
					</footer>
				</div>
				</div>

				<DraggableCard
					fixedX
					className='hidden md:block md:absolute md:bottom-4 md:top-10 md:right-10 md:w-80 max-w-full z-50'
					header={
						<div className='flex w-full items-center gap-1 text-slate-700 font-medium truncate'>
							<span className='mr-2 truncate'>Воспроизведение</span>
							{mainIcom?.playing && <PlayFill size='1rem' />}
						</div>
					}
				>
				<Card.Body className='overflow-y-clip truncate min-h-0 max-h-[60vh]'>
					{mainIcom ? (
						<div className='flex flex-col gap-2'>
							{mainIcom.playing && <IcomQuery queryInfo={mainIcom.playing} />}
							{mainIcom.queue.map((q) => (
								<IcomQuery key={q.id} queryInfo={q} />
							))}
							{!mainIcom.playing && mainIcom.queue.length === 0 && (
								<Note>Очередь воспроизведения пуста</Note>
							)}
						</div>
					) : (
						<div className='flex items-center gap-2'>
							<Spinner /> Загрузка...
						</div>
					)}
					</Card.Body>
				</DraggableCard>

				<Offcanvas
					show={isMobileNavOpen}
					onHide={() => setIsMobileNavOpen(false)}
					placement='start'
					className='md:hidden bg-[#F1F5F9]'
				>
					<Offcanvas.Header closeButton className='border-b border-slate-200'>
						<Offcanvas.Title className='flex items-center gap-2 text-xl font-bold text-slate-700'>
							<BellFill size='1.3rem' className='origin-top' />
							<span>BMaster</span>
						</Offcanvas.Title>
					</Offcanvas.Header>
					<Offcanvas.Body className='flex h-full flex-col p-3'>
						<SidebarNavLinks onNavigate={() => setIsMobileNavOpen(false)} />
						<div className='mt-auto border-t border-slate-200 pt-3'>
							<div className='mb-2 flex items-center gap-2 rounded-lg bg-slate-200/70 px-3 py-2 text-sm text-slate-700'>
								{profile}
							</div>
							<button
								type='button'
								className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-200/80'
								onClick={handleLogout}
							>
								<DoorOpen size='1.1rem' />
								<span>Выйти</span>
							</button>
						</div>
					</Offcanvas.Body>
				</Offcanvas>
			</LocalUserProvider>
		);
	}
