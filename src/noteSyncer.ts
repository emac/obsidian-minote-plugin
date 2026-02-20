/**
 * @file 笔记同步引擎
 * @author Emac
 * @date 2025-01-05
 */
import { get } from 'svelte/store';

import { settingsStore } from './settings';
import FileManager from './fileManager';
import MinoteApi from './minoteApi';
import path from 'path';
import type { Note, Folder, SyncInfo, ImageInfo } from './models';

export default class NoteSyncer {
	private fileManager: FileManager;
	private minoteApi: MinoteApi;
	private notes: Note[] = [];
	private folders: Folder[] = [];
	private folderDict: Record<string, string> = {};
	private thisTimeSynced: SyncInfo[] = [];
	private lastSyncedFolders: Record<string, SyncInfo> = {};
	private lastSyncedNotes: Record<string, SyncInfo> = {};

	constructor(fileManager: FileManager, minoteApi: MinoteApi) {
		this.fileManager = fileManager;
		this.minoteApi = minoteApi;
	}

	public async sync(force = false) {
		this.clear();

		if (force) {
			settingsStore.actions.clearLastTimeSynced();
		}

		// 加载上次同步信息
		this.lastSyncedFolders= get(settingsStore).lastTimeSynced
			.filter(note => note.type === 'folder')
			.reduce((acc: Record<string, SyncInfo>, note: SyncInfo) => {
				acc[note.id] = note;
				return acc;
			}, {});
		this.lastSyncedNotes = get(settingsStore).lastTimeSynced
			.filter(note => note.type === 'note')
			.reduce((acc: Record<string, SyncInfo>, note: SyncInfo) => {
				acc[note.id] = note;
				return acc;
			}, {});

		await this.fetchNotesAndFolders();
		await this.createFolders();
		const count = await this.syncNotes();

		// 更新上次同步信息
		settingsStore.actions.setLastTimeSynced(this.thisTimeSynced);

		return count;
	}

	private clear() {
		this.notes = [];
		this.folders = [];
		this.folderDict = {};
		this.thisTimeSynced = [];
	}

	private async fetchNotesAndFolders() {
		// 获取第一页
		let page = await this.minoteApi.fetchPage();
		while (true) {
			for (const entry of page.data.entries) {
				if (entry.type === 'note') {
					// 解析笔记
					let title = '';
					if (entry.extraInfo) {
						const extra = JSON.parse(entry.extraInfo);
						title = extra.title || '';
					}
					if (!title) {
						title = entry.snippet.split('\n')[0] + `_${entry.id}`;
					}
					// 去除标题中的HTML标签
					title = title.replace(/<[^>]+>/g, '');
					// 去除标题中的非法字符 \/:*?"<>| 和换行符
					title = title.replace(/[\\\/:*?"<>|\n]/g, '');

					const note: Note = {
						id: entry.id,
						title,
						createDate: entry.createDate,
						modifyDate: entry.modifyDate,
						folderId: entry.folderId.toString(),
					};
					this.notes.push(note);
				}
			}

			for (const entry of page.data.folders) {
				if (entry.type === 'folder') {
					// 解析文件夹
					const folder: Folder = {
						id: entry.id.toString(),
						name: entry.subject,
						createDate: entry.createDate,
					};
					this.folders.push(folder);
				}
			}

			// 检查是否需要获取下一页
			if (page.data.lastPage) {
				break;
			}

			// 获取下一页
			page = await this.minoteApi.fetchPage(page.data.syncTag);
		}
	}

	private async createFolders() {
		// 添加默认文件夹
		this.folders.push({ id: '0', name: '未分类', createDate: Date.now() });

		for (const folder of this.folders) {
			// 更新文件夹字典
			this.folderDict[folder.id] = folder.name;

			// 如果上次曾同步过
			if (folder.id in this.lastSyncedFolders) {
				const oldFolderName = this.lastSyncedFolders[folder.id].name;
				if (folder.name !== oldFolderName) {
					// 重命名文件夹
					await this.fileManager.renameFolder(oldFolderName, folder.name);
					this.lastSyncedFolders[folder.id].name = folder.name;
					// 更新笔记路径
					for (const note of Object.values(this.lastSyncedNotes)) {
						if (note.relativePath && note.relativePath.startsWith(oldFolderName + path.sep)) {
							note.relativePath = note.relativePath.replace(oldFolderName, folder.name);
						}
					}
				}

				// 添加到已处理文件夹列表
				this.lastSyncedFolders[folder.id].syncTime = Date.now();
				this.thisTimeSynced.push(this.lastSyncedFolders[folder.id]);
				continue;
			}

			// 创建文件夹目录
			await this.fileManager.createFolder(folder.name, folder.createDate);

			// 添加到已处理文件夹列表
			this.thisTimeSynced.push({
				id: folder.id,
				type: 'folder',
				name: folder.name,
				relativePath: folder.name,
				syncTime: Date.now()
			});
		}
	}

	private async syncNotes() {
		let syncedCount = 0;

		// 记录此次同步信息
		for (const note of this.notes) {
			try {
				// 如果笔记未修改则跳过
				if (note.id in this.lastSyncedNotes && note.modifyDate <= this.lastSyncedNotes[note.id].syncTime) {
					// 添加到已处理笔记列表
					this.thisTimeSynced.push(this.lastSyncedNotes[note.id]);
					continue;
				}

				const folderName = this.folderDict[note.folderId];
				const folderPath = folderName;

				// 删除旧笔记
				if (note.id in this.lastSyncedNotes) {
					await this.fileManager.deleteFile(this.lastSyncedNotes[note.id].relativePath);
				}

				// 获取笔记内容
				const noteDetails = await this.minoteApi.fetchNoteDetails(note.id);

				// 处理图片
				const imgDict: Record<string, string> = {};
				const downloadPromises: Promise<void>[] = [];

				if (noteDetails.data.entry.setting?.data) {
					const images: ImageInfo[] = [];
					for (const img of noteDetails.data.entry.setting.data) {
						const fileId = img.fileId;
						const fileType = img.mimeType.replace('image/', '');
						images.push({ fileId, fileType });
						imgDict[fileId] = fileType;
					}

					// 创建图片目录
					const imgDir = path.join(folderPath, 'img');
					await this.fileManager.createFolder(imgDir, Date.now());

					// 并行下载图片
					for (const img of images) {
						const imgPath = path.join(imgDir, `${img.fileId}.${img.fileType}`);
						downloadPromises.push(this.downloadImage(img.fileId, imgPath));
					}
				}

				// 等待所有图片下载完成
				await Promise.all(downloadPromises);

				// 转换内容
				let content = noteDetails.data.entry.content;

				// 规则1: 移除<text>标签
				content = content.replace(/<text[^>]*>(.*?)<\/text>/g, '$1');

				// 规则2: 转换background标签
				content = content.replace(
					/<background color="#([^"]*)">(.*?)<\/background>/g,
					'<span style="background-color: #$1">$2</span>'
				);

				// 规则3: 转换图片行 (☺格式)
				content = content.replace(/☺\s+([^<]+)(<0\/><\/>)?/gm, (match: any, fileId: any) => {
					return fileId in imgDict ? `![](img/${fileId}.${imgDict[fileId]})` : match;
				});

				// 规则4: 转换图片行 (<img>格式)
				content = content.replace(
					/<img fileid="([^"]+)" imgshow="0" imgdes="" \/>/g, (match: any, fileId: any) => {
						return fileId in imgDict ? `![](img/${fileId}.${imgDict[fileId]})` : match;
					}
				);

				// 规则5: 移除<new-format/>标签
				content = content.replace(/<new-format\/>/g, '');

				// 保存转换后的内容
				const notePath = path.join(folderPath, `${note.title}.md`);
				await this.fileManager.saveFile(notePath, content, note.createDate, note.modifyDate);

				syncedCount++;
				// 添加到已处理笔记列表
				this.thisTimeSynced.push({
					id: note.id,
					type: 'note',
					name: note.title,
					relativePath: notePath,
					syncTime: note.modifyDate
				});
			} catch (err) {
				console.error('[minote plugin] sync MI note error: ', note, err);
				continue;
			}
		}

		return syncedCount
	}

	private async downloadImage(fileId: string, imgPath: string) {
		if (await this.fileManager.exists(imgPath)) {
			return;
		}

		const imgBinary = await this.minoteApi.fetchImage(fileId);
		await this.fileManager.saveBinaryFile(imgPath, imgBinary);
	}
}
