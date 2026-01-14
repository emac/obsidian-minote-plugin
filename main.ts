/**
 * @file 插件主函数
 * @author Emac
 * @date 2025-01-05
 */
import { App, Menu, Notice, Platform, Plugin } from 'obsidian';

import { settingsStore } from './src/settings';
import { MinoteSettingTab } from './src/settingTab';
import FileManager from './src/fileManager';
import MinoteApi from './src/minoteApi';
import NoteSyncer from './src/noteSyncer';

export default class MinotePlugin extends Plugin {
	private noteSyncer: NoteSyncer;
	private syncing = false;

	async onload() {
		await settingsStore.initialize(this);

		const fileManager = new FileManager(this.app.vault, this.app.metadataCache);
		const minoteApi = new MinoteApi();
		this.noteSyncer = new NoteSyncer(this.app, fileManager, minoteApi);

		const ribbonEl = this.addRibbonIcon('cloud-download', '同步小米笔记', (event) => {
			if (event.button === 0) {
				this.startSync();
			}
		});

		ribbonEl.addEventListener('contextmenu', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation(); // 阻止事件传播

			const preventDefaultMouseDown = (mouseDownEvent: MouseEvent) => {
				mouseDownEvent.preventDefault();
			};

			// 额外阻止mousedown事件的默认行为
			window.addEventListener('mousedown', preventDefaultMouseDown);

			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle('同步小米笔记')
					.setIcon('refresh-ccw')
					.onClick(() => {
						this.startSync();
					})
			);

			menu.addItem((item) =>
				item
					.setTitle('强制同步小米笔记')
					.setIcon('refresh-ccw-dot')
					.onClick(() => {
						this.startSync(true);
					})
			);

			menu.showAtMouseEvent(event);
			menu.onHide(() => {
				window.removeEventListener('mousedown', preventDefaultMouseDown);
			});
		});

		this.addCommand({
			id: 'sync',
			name: '同步小米笔记',
			callback: () => {
				this.startSync();
			}
		});

		this.addCommand({
			id: 'force-sync',
			name: '强制同步小米笔记',
			callback: () => {
				this.startSync(true);
			}
		});

		this.addSettingTab(new MinoteSettingTab(this.app, this));
	}

	async startSync(force = false) {
		if (this.syncing) {
			new Notice('正在同步小米笔记，请勿重复点击');
			return;
		}
		this.syncing = true;
		try {
			new Notice('开始同步小米笔记...');
			const syncedCount = await this.noteSyncer.sync(force);
			new Notice(`已同步 ${syncedCount} 篇小米笔记`);
		} catch (e) {
			new Notice('同步小米笔记异常，请打开设置页面检查登录状态或者刷新Cookie');
			console.error('[minote plugin] failed to sync MI notes', e);
		} finally {
			this.syncing = false;
		}
	}

	onunload() {
	}
}
