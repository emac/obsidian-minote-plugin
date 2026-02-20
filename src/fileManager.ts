/**
 * @file Vault 文件管理器
 * @author Emac
 * @date 2025-01-05
 */
import { normalizePath } from 'obsidian';
import type { Vault, MetadataCache } from 'obsidian';
import { get } from 'svelte/store';
import path from 'path';
import fs from 'fs';

import { settingsStore } from './settings';

export default class FileManager {
	private vault: Vault;
	private metadataCache: MetadataCache;

	constructor(vault: Vault, metadataCache: MetadataCache) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		// 创建默认文件夹（如果不存在）
		this.createFolder("", Date.now());
	}

	async exists(filePath: string) {
		if (!filePath) {
			return false;
		}

		return this.vault.adapter.exists(normalizePath(path.join(get(settingsStore).noteLocation, filePath)));
	}

	async createFolder(folderPath: string, createDate: number) {
		if (!folderPath || await this.exists(folderPath)) {
			return;
		}

		const fullPath = normalizePath(path.join(get(settingsStore).noteLocation, folderPath));
		await this.vault.createFolder(fullPath);
		const absolutePath = (this.vault.adapter as any).getFullPath(fullPath);
		fs.utimesSync(absolutePath, createDate / 1000, createDate / 1000);
	}

	async renameFolder(oldPath: string, newPath: string) {
		if (!oldPath || !newPath) {
			return;
		}

		if (await !this.exists(oldPath) || await this.exists(newPath)) {
			return;
		}

		this.vault.adapter.rename(normalizePath(path.join(get(settingsStore).noteLocation, oldPath)), normalizePath(path.join(get(settingsStore).noteLocation, newPath)));
	}

	async deleteFile(filePath: string) {
		if (!filePath || !await this.exists(filePath)) {
			return;
		}

		this.vault.adapter.remove(normalizePath(path.join(get(settingsStore).noteLocation, filePath)));
	}

	async saveFile(filePath: string, content: string, createDate: number, modifyDate: number) {
		if (!filePath) {
			return;
		}

		const fullPath = normalizePath(path.join(get(settingsStore).noteLocation, filePath));
		await this.vault.adapter.write(fullPath, content);
		const absolutePath = (this.vault.adapter as any).getFullPath(fullPath);
		fs.utimesSync(absolutePath, createDate / 1000, modifyDate / 1000);
	}

	async saveBinaryFile(filePath: string, binary: ArrayBuffer) {
		if (!filePath) {
			return;
		}

		this.vault.adapter.writeBinary(normalizePath(path.join(get(settingsStore).noteLocation, filePath)), binary);
	}
}
