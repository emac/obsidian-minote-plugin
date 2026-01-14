/**
 * @file 同步模型
 * @author Emac
 * @date 2025-01-05
 */
export interface Note {
	id: string;
	title: string;
	modifyDate: number;
	folderId: string;
}

export interface Folder {
	id: string;
	name: string;
}

export interface ImageInfo {
	fileId: string;
	fileType: string;
}

export interface SyncInfo {
	id: string;
	type: string;
	name: string;
	syncTime: number;
	folderName?: string;
}
