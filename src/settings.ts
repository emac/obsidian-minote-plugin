/**
 * @file 插件配置
 * @author Emac
 * @date 2025-01-05
 */
import { writable } from 'svelte/store';

import MinotePlugin from 'main';
import type { SyncInfo } from './models';

interface MinotePluginSettings {
	noteLocation: string;
	host: string;
	cookie: string;
	isCookieValid: boolean;
	user: string;
	lastTimeSynced: SyncInfo[];
};

const DEFAULT_SETTINGS: MinotePluginSettings = {
	noteLocation: 'minote',
	host: "i.mi.com",
	cookie: '',
	isCookieValid: false,
	user: '',
	lastTimeSynced: [],
};

const createSettingsStore = () => {
	const store = writable(DEFAULT_SETTINGS as MinotePluginSettings);

	let _plugin!: MinotePlugin;

	const initialize = async (plugin: MinotePlugin): Promise<void> => {
		_plugin = plugin;

		const data = Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());
		const settings: MinotePluginSettings = { ...data };
		store.set(settings);
	};

	store.subscribe(async (settings) => {
		if (_plugin) {
			const data = { ...settings };
			await _plugin.saveData(data);
		}
	});

	const setNoteLocationFolder = (value: string) => {
		store.update((state) => {
			state.noteLocation = value;
			return state;
		});
	};

	const setHost = (value: string) => {
		store.update((state) => {
			state.host = value;
			return state;
		});
	};

	const clearCookie = () => {
		store.update((state) => {
			state.cookie = '';
			state.isCookieValid = false;
			state.user = '';
			return state;
		});
	};

	const setCookie = (cookie: string) => {
		store.update((state) => {
			state.cookie = cookie;
			state.isCookieValid = true;
			return state;
		});
	};

	const setUser = (user: string) => {
		store.update((state) => {
			state.user = user;
			return state;
		});
	};

	const clearLastTimeSynced = () => {
		store.update((state) => {
			state.lastTimeSynced = [];
			return state;
		});
	};

	const setLastTimeSynced = (synced: SyncInfo[]) => {
		store.update((state) => {
			state.lastTimeSynced = synced;
			return state;
		});
	};

	return {
		subscribe: store.subscribe,
		initialize,
		actions: {
			setNoteLocationFolder,
			setHost,
			clearCookie,
			setCookie,
			setUser,			
			clearLastTimeSynced,
			setLastTimeSynced,
		}
	}
};

export const settingsStore = createSettingsStore()
