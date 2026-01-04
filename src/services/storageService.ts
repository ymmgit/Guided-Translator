// Storage Service
// Handles local persistence using IndexedDB via idb or raw API
// For simplicity and no extra deps, we'll use a Promise wrapper around raw IndexedDB

import { Project, ChunkData } from '../types';

const DB_NAME = 'GuidedTranslatorDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_CHUNKS = 'chunks';

export class StorageService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Projects store
                if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                    db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
                }

                // Chunks store - indexed by projectId
                if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
                    const store = db.createObjectStore(STORE_CHUNKS, { keyPath: ['projectId', 'chunkId'] });
                    store.createIndex('projectId', 'projectId', { unique: false });
                }
            };
        });
    }

    // --- Project Operations ---

    async saveProject(project: Project): Promise<void> {
        return this.performTransaction(STORE_PROJECTS, 'readwrite', (store) => {
            store.put(project);
        });
    }

    async updateProjectStatus(id: string, status: Project['status']): Promise<void> {
        const project = await this.getProject(id);
        if (project) {
            project.status = status;
            project.lastModified = Date.now();
            await this.saveProject(project);
        }
    }

    async updateProjectProgress(id: string, translatedCount: number): Promise<void> {
        const project = await this.getProject(id);
        if (project) {
            project.translatedChunks = translatedCount;
            await this.saveProject(project);
        }
    }

    async getProject(id: string): Promise<Project | undefined> {
        return this.performTransaction(STORE_PROJECTS, 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getProjectByTitle(title: string): Promise<Project | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(STORE_PROJECTS, 'readonly');
            const store = transaction.objectStore(STORE_PROJECTS);
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    const project = cursor.value as Project;
                    if (project.standardTitle === title) {
                        resolve(project);
                        return;
                    }
                    cursor.continue();
                } else {
                    resolve(undefined);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async listProjects(): Promise<Project[]> {
        return this.performTransaction(STORE_PROJECTS, 'readonly', (store) => {
            return store.getAll();
        });
    }

    // --- Chunk Operations ---

    async saveChunks(chunks: ChunkData[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(STORE_CHUNKS, 'readwrite');
            const store = transaction.objectStore(STORE_CHUNKS);

            chunks.forEach(chunk => store.put(chunk));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getProjectChunks(projectId: string): Promise<ChunkData[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(STORE_CHUNKS, 'readonly');
            const store = transaction.objectStore(STORE_CHUNKS);
            const index = store.index('projectId');
            const request = index.getAll(projectId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProject(projectId: string): Promise<void> {
        // Delete project metadata
        await this.performTransaction(STORE_PROJECTS, 'readwrite', (store) => {
            store.delete(projectId);
        });

        // Delete associated chunks
        // Note: Generic IDB doesn't support "delete where index = x" easily without cursor or range delete on key
        // We will simple iterate and delete for now. Since chunks have composite key [projectId, chunkId]
        // This is tricky. A simpler way for a clean implementation without range delete logic
        // is to iterate the index cursor and delete matches.

        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(STORE_CHUNKS, 'readwrite');
            const store = transaction.objectStore(STORE_CHUNKS);
            const index = store.index('projectId');
            const request = index.openCursor(IDBKeyRange.only(projectId));

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // --- Helper ---

    private async performTransaction(
        storeName: string,
        mode: IDBTransactionMode,
        action: (store: IDBObjectStore) => IDBRequest | void
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);

            let request: IDBRequest | void;
            try {
                request = action(store);
            } catch (e) {
                reject(e);
                return;
            }

            transaction.oncomplete = () => {
                if (request instanceof IDBRequest) {
                    resolve(request.result);
                } else {
                    resolve(undefined);
                }
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }
}

export const storageService = new StorageService();
