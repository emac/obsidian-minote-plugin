/**
 * @file Vault 文件管理器
 * @author Emac
 * @date 2025-01-05
 */
import { Vault, MetadataCache, TFile, TFolder, Notice, TAbstractFile, normalizePath } from 'obsidian';
import { get } from 'svelte/store';
import path from 'path';

import { settingsStore } from './settings';

export default class FileManager {
	private vault: Vault;
	private metadataCache: MetadataCache;

	constructor(vault: Vault, metadataCache: MetadataCache) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		// 创建默认文件夹（如果不存在）
		this.createFolder("");
	}

	async exists(filePath: string) {
		return this.vault.adapter.exists(normalizePath(path.join(get(settingsStore).noteLocation, filePath)));
	}

	async createFolder(folderPath: string) {
		if (await this.exists(folderPath)) {
			return;
		}

		this.vault.createFolder(normalizePath(path.join(get(settingsStore).noteLocation, folderPath)));
	}

	async renameFolder(oldPath: string, newPath: string) {
		if (await !this.exists(oldPath) || await this.exists(newPath)) {
			return;
		}

		this.vault.adapter.rename(normalizePath(path.join(get(settingsStore).noteLocation, oldPath)), normalizePath(path.join(get(settingsStore).noteLocation, newPath)));
	}

	async deleteFile(filePath: string) {
		if (!await this.exists(filePath)) {
			return;
		}

		this.vault.adapter.remove(normalizePath(path.join(get(settingsStore).noteLocation, filePath)));
	}

	async saveFile(filePath: string, content: string, mtime?: number, ctime?: number) {
		const fullPath = normalizePath(path.join(get(settingsStore).noteLocation, filePath));
		await this.vault.adapter.write(fullPath, content);
		
		// 如果提供了时间戳，设置文件的修改时间和创建时间
		if (mtime !== undefined || ctime !== undefined) {
			try {
				const fs = (window as any).require('fs');
				const absolutePath = (this.vault.adapter as any).getFullPath(fullPath);
				
				// 获取当前文件状态
				const stats = fs.statSync(absolutePath);
				
				// 设置访问时间和修改时间（Node.js utimes只能设置这两个）
				const atimeMs = mtime !== undefined ? mtime : stats.atimeMs;
				const mtimeMs = mtime !== undefined ? mtime : stats.mtimeMs;
				
				fs.utimesSync(absolutePath, new Date(atimeMs), new Date(mtimeMs));
			} catch (e) {
				console.warn('[Minote Plugin] 设置文件时间戳失败', e);
			}
		}
	}

	async saveBinaryFile(filePath: string, binary: ArrayBuffer) {
		this.vault.adapter.writeBinary(normalizePath(path.join(get(settingsStore).noteLocation, filePath)), binary);
	}
}
