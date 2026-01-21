import { DataAdapter, normalizePath } from "obsidian";
import { dirname } from "path-browserify";

interface ImageMap {
  [localPath: string]: string;
}

export class ImageStore {
  private adapter: DataAdapter;
  private manifestPath: string;
  private map: ImageMap = {};
  private dirty: boolean = false;
  private saveTimer: any = null;

  constructor(adapter: DataAdapter, manifestPath: string) {
    this.adapter = adapter;
    this.manifestPath = manifestPath;
  }

  async load() {
    if (await this.adapter.exists(this.manifestPath)) {
      try {
        const content = await this.adapter.read(this.manifestPath);
        this.map = JSON.parse(content);
      } catch (e) {
        console.error("Failed to load image map:", e);
        this.map = {};
      }
    }
  }

  async save() {
    if (this.dirty) {
      try {
        await this.adapter.write(this.manifestPath, JSON.stringify(this.map, null, 2));
        this.dirty = false;
      } catch (e) {
        console.error("Failed to save image map:", e);
      }
    }
  }

  // 防抖保存
  private scheduleSave() {
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.save();
    }, 2000); // 2秒后保存
  }

  getRemote(localPath: string): string | undefined {
    return this.map[localPath];
  }

  getLocal(remoteUrl: string): string | undefined {
    // 简单的反向查找，性能可能一般，但考虑到这是一个辅助功能，应该可以接受
    // 如果性能成为瓶颈，可以维护两个 map
    for (const [local, remote] of Object.entries(this.map)) {
      if (remote === remoteUrl) {
        return local;
      }
    }
    return undefined;
  }

  set(localPath: string, remoteUrl: string) {
    if (this.map[localPath] !== remoteUrl) {
      this.map[localPath] = remoteUrl;
      this.scheduleSave();
    }
  }
}
