/**
 * @file 笔记同步引擎
 * @author Emac
 * @date 2025-01-05
 */
import { get } from 'svelte/store';
import TurndownService from 'turndown';
import { App, Notice, TFile } from 'obsidian';
import path from 'path';

import { settingsStore } from './settings';
import FileManager from './fileManager';
import MinoteApi from './minoteApi';
import type { Note, Folder, SyncInfo } from './models';

export default class NoteSyncer {
    private app: App;
	private fileManager: FileManager;
	private minoteApi: MinoteApi;
	private notes: Note[] = [];
	private folders: Folder[] = [];
	private folderDict: Record<string, string> = {};
	private thisTimeSynced: SyncInfo[] = [];
    private turndownService: TurndownService;
    private attachmentLinkMap: Map<string, string>;

	constructor(app: App, fileManager: FileManager, minoteApi: MinoteApi) {
		this.app = app;
		this.fileManager = fileManager;
		this.minoteApi = minoteApi;
        this.attachmentLinkMap = new Map();
        this.initializeTurndown();
	}

    private initializeTurndown(): void {
        this.turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

        // 禁用转义，避免URL中的特殊字符被转义（如 _ 变成 \_）
        this.turndownService.escape = (text: string) => text;

        // 规则：转换 <background> 标签为 Obsidian 高亮
        this.turndownService.addRule('highlight', {
            filter: (node) => node.nodeName === 'BACKGROUND',
            replacement: (content) => `==${content}==`
        });
        
        // 规则：转换 <i> 标签为斜体
        this.turndownService.addRule('italic', {
            filter: (node) => node.nodeName === 'I',
            replacement: (content) => `*${content}*`
        });
        
        // 规则：转换 <u> 标签为下划线（使用 HTML，因为 Markdown 不支持）
        this.turndownService.addRule('underline', {
            filter: (node) => node.nodeName === 'U',
            replacement: (content) => `<u>${content}</u>`
        });
        
        // 保持<a>标签，Turndown会自动转换为markdown链接 [text](url)
        
        // 规则：转换 <input type="checkbox"> 为待办列表
        this.turndownService.addRule('task-list', {
            filter: (node) => node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
            replacement: (content, node) => {
                const isChecked = (node as Element).hasAttribute('checked');
                let label = '';
                let nextSibling = node.nextSibling;
                if (nextSibling && nextSibling.nodeType === 3) { // TEXT_NODE
                    const text = nextSibling.nodeValue || '';
                    // 如果文本只包含换行符，保留换行；否则提取标签文本
                    if (text.trim()) {
                        label = text.trim();
                        // 清理掉已处理的文本节点，避免重复渲染
                        nextSibling.nodeValue = '';
                    }
                }
                return (isChecked ? '- [x] ' : '- [ ] ') + label + '\n';
            }
        });
    }

	public async sync(force = false): Promise<number> {
		this.clear();
		if (force) {
			settingsStore.actions.clearLastTimeSynced();
		}
		await this.fetchNotesAndFolders();
		await this.buildFolderDict(); 
		const count = await this.syncNotes(force);
        // 只保存笔记的同步信息
		settingsStore.actions.setLastTimeSynced(this.thisTimeSynced.filter(s => s.type === 'note'));
		return count;
	}

	private clear(): void {
		this.notes = [];
		this.folders = [];
		this.folderDict = {};
		this.thisTimeSynced = [];
	}

	private async fetchNotesAndFolders(): Promise<void> {
		let syncTag = '';
		while (true) {
			const page = await this.minoteApi.fetchPage(syncTag);
			for (const entry of page.data.entries) {
				if (entry.type === 'note') {
					let title = '';
					let snippet = entry.snippet || '';
					if (entry.extraInfo) {
						const extra = JSON.parse(entry.extraInfo);
						title = extra.title || '';
						if (extra.note_content_type === 'mind') {
							snippet = extra.mind_content_plain_text;
						}
					}
					if (!title) {
						title = snippet.split('\n')[0].substring(0, 50) || '无标题笔记';
						title = `${title}_${entry.id}`;
					}
					title = title.replace(/<[^>]+>/g, '').replace(/[\\/:*?"<>|]/g, '').trim();

					this.notes.push({
						id: entry.id,
						title,
						modifyDate: entry.modifyDate,
						folderId: entry.folderId.toString(),
					});
				}
			}

			// 仍然获取文件夹信息，用于构建标签
			for (const folder of page.data.folders) {
				if (folder.type === 'folder') {
					this.folders.push({
						id: folder.id.toString(),
						name: folder.subject,
					});
				}
			}

			if (page.data.lastPage) {
				break;
			}
			syncTag = page.data.syncTag;
		}
	}

	private async buildFolderDict(): Promise<void> {
		// 添加已知的文件夹映射作为fallback（小米API返回的folder数据不完整）
		this.folderDict['0'] = '未分类';
		this.folderDict['4'] = '摘录';
		this.folderDict['6'] = '灵感速记';
		
		// 添加API返回的文件夹
		for (const folder of this.folders) {
			const tagName = folder.name.replace(/[\s/]/g, '_');
			this.folderDict[folder.id] = tagName;
		}
	}

	private async syncNotes(force: boolean): Promise<number> {
		let syncedCount = 0;
		const lastSyncedNotes: Record<string, SyncInfo> = get(settingsStore).lastTimeSynced
			.filter(item => item.type === 'note') // 兼容性：只加载笔记信息
			.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
        
        await this.fileManager.createFolder('');

		for (const note of this.notes) {
			try {
				const lastSynced = lastSyncedNotes[note.id];
				
				if (!force && lastSynced && note.modifyDate <= lastSynced.syncTime) {
					this.thisTimeSynced.push(lastSynced);
					continue;
				}

				const noteFileName = `${note.id}.md`;
                const noteFilePath = path.join(get(settingsStore).noteLocation, noteFileName);
				
				const noteDetails = await this.minoteApi.fetchNoteDetails(note.id);
				const { entry } = noteDetails.data;
				const extraInfo = JSON.parse(entry.extraInfo || '{}');
				const attachments = entry.setting?.data || [];
                
                this.attachmentLinkMap.clear();

				if (attachments.length > 0) {
					const attachmentPromises = attachments.map((att: any) => 
                        this.saveAttachmentAndGenerateLink(att, noteFilePath)
                    );
					await Promise.all(attachmentPromises);
				}

				let htmlContent = this.preprocessHtmlForTurndown(entry, extraInfo);
                if (extraInfo.note_content_type === 'handwrite') {
                    const thumbnailDigest = extraInfo.thumbnail;
                    const thumbnailInfo = attachments.find((d: any) => d.digest === thumbnailDigest);
                    if (thumbnailInfo) {
                        htmlContent += `<img data-fileid="${thumbnailInfo.fileId}" />`;
                    }
                }
                
                this.addAttachmentRules();
				let markdownBody = this.turndownService.turndown(htmlContent);

                const folderNameForTag = this.folderDict[note.folderId] || '未分类';
                const noteType = extraInfo.note_content_type || 'common';
                
                // 只在原笔记有title时才添加aliases，避免使用自动生成的"无标题_ID"作为alias
                const aliasLine = extraInfo.title ? `aliases: ["${note.title.replace(/"/g, '\\"')}"]
` : '';
                
                const frontmatter = `---
${aliasLine}type: ${noteType}
tags:
  - 小米导入
  - 小米导入/${folderNameForTag}
created: ${(window as any).moment(entry.createDate).format()}
modified: ${(window as any).moment(entry.modifyDate).format()}
---

`;
                
				const finalContent = frontmatter + markdownBody;
				await this.fileManager.saveFile(noteFileName, finalContent, entry.modifyDate, entry.createDate);
				
				syncedCount++;
				this.thisTimeSynced.push({
					id: note.id,
					type: 'note',
					name: note.title,
					syncTime: note.modifyDate,
					folderName: folderNameForTag,
				});

			} catch (err) {
				console.error(`[Minote Plugin] 同步笔记失败: ${note.title} (${note.id})`, err);
			}
		}
		return syncedCount;
	}

    private async saveAttachmentAndGenerateLink(attachment: any, sourceNotePath: string): Promise<void> {
        const { fileId, mimeType } = attachment;
        const fileExt = mimeType.split('/')[1] || 'bin';
        const attachmentFileName = `${fileId}.${fileExt}`;
        
        const attachmentPath = await this.app.fileManager.getAvailablePathForAttachment(
            attachmentFileName,
            sourceNotePath
        );
        
        const existingFile = this.app.vault.getAbstractFileByPath(attachmentPath);
        if (existingFile instanceof TFile) {
            const link = this.app.fileManager.generateMarkdownLink(existingFile, sourceNotePath);
            this.attachmentLinkMap.set(fileId, link);
            return;
        }

        try {
            const binary = await this.minoteApi.fetchImage(fileId);
            const savedFile = await this.app.vault.createBinary(attachmentPath, binary);
            const link = this.app.fileManager.generateMarkdownLink(savedFile, sourceNotePath);
            this.attachmentLinkMap.set(fileId, link);
        } catch (e) {
            new Notice(`下载附件失败: ${fileId}`);
            console.error(`[Minote Plugin] 下载附件失败 ${fileId}`, e);
        }
    }
    
    private addAttachmentRules(): void {
        const createReplacement = (node: Element): string => {
            const fileId = node.getAttribute('data-fileid');
            const link = this.attachmentLinkMap.get(fileId || '') || '';
            // 确保链接以 ![[]] 格式包裹（Obsidian嵌入附件语法）
            // Obsidian的generateMarkdownLink可能返回[[]]或![[]]，统一处理
            if (link && !link.startsWith('!')) {
                return '!' + link;
            }
            return link;
        };

        this.turndownService.addRule('audio', {
            filter: (node) => node.nodeName === 'AUDIO' && node.hasAttribute('data-fileid'),
            replacement: (content, node) => createReplacement(node as Element)
        });

        this.turndownService.addRule('image', {
            filter: (node) => node.nodeName === 'IMG' && node.hasAttribute('data-fileid'),
            replacement: (content, node) => createReplacement(node as Element)
        });
    }

    private preprocessHtmlForTurndown(entry: any, extraInfo: any): string {
        let content = '';
        switch (extraInfo.note_content_type) {
			case 'mind':
				return `# ${entry.title || extraInfo.title || '思维导图'}\n\n${extraInfo.mind_content_plain_text || ''}`;
			case 'handwrite':
				// handwrite 数据存储在 mind_content 中的 JSON
				try {
					if (extraInfo.mind_content && extraInfo.mind_content.startsWith('<HandWrite Prdfix>')) {
						const jsonStr = extraInfo.mind_content.replace('<HandWrite Prdfix>', '');
						const handwriteData = JSON.parse(jsonStr);
						return handwriteData.textContent || '';
					}
				} catch (e) {
					console.error('[Minote Plugin] 解析手写笔记失败', e);
				}
				return '';
			default:
				content = entry.content || '';
		}

        // 处理 <text> 标签为段落
        content = content
            .replace(/<text[^>]*>\s*<\/text>/g, '<p><br></p>')  // 空text标签转换为空段落
            .replace(/<text[^>]*>/g, '<p>')
            .replace(/<\/text>\n/g, '</p>')  // text结束标签+换行符一起处理，避免双重换行
            .replace(/<\/text>/g, '</p>')    // 剩余的text结束标签
            .replace(/<new-format\/?>>/g, '');

		// 转换附件和checkbox标签
		content = content.replace(/<sound fileid="([^"]+)"[^>]*\/>/g, `<audio data-fileid="$1"></audio>`);
		content = content.replace(/<img fileid="([^"]+)"[^>]*>/g, `<img data-fileid="$1"></img>`);
		content = content.replace(/☺\s+([^<]+)(?:<0\/><\/>)?/g, (match, fileId) => `<img data-fileid="${fileId.trim()}"></img>`);
		
		// 处理剩余的换行符（用于非text标签包裹的内容）
		content = content.replace(/\n/g, '<br>');

		return content;
    }
}