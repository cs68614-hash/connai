import { CACHE_CONFIG } from './constants';

/**
 * 工作区的缓存管理 (文件、忽略规则等)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private totalSize: number = 0;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly maxEntries: number;

  constructor(
    maxSize: number = CACHE_CONFIG.MAX_FILE_CACHE_SIZE,
    ttl: number = CACHE_CONFIG.CACHE_TTL,
    maxEntries: number = CACHE_CONFIG.MAX_CACHE_ENTRIES
  ) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.maxEntries = maxEntries;
  }

  /**
   * 获取单例实例
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 设置缓存项
   */
  set<T>(key: string, data: T): void {
    const size = this.calculateSize(data);
    
    // 检查是否超过单个条目大小限制
    if (size > this.maxSize / 10) {
      console.warn(`Cache entry too large: ${key} (${size} bytes)`);
      return;
    }

    // 删除旧条目（如果存在）
    if (this.cache.has(key)) {
      this.remove(key);
    }

    // 检查缓存大小限制
    while (this.totalSize + size > this.maxSize || this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    // 添加新条目
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      size,
    };

    this.cache.set(key, entry);
    this.totalSize += size;
  }

  /**
   * 获取缓存项
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.remove(key);
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * 检查缓存项是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.remove(key);
      return false;
    }

    return true;
  }

  /**
   * 移除缓存项
   */
  remove(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.cache.delete(key);
      this.totalSize -= entry.size;
      return true;
    }
    
    return false;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  /**
   * 获取或设置缓存项（如果不存在则通过工厂函数创建）
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }

    const data = await factory();
    this.set(key, data);
    return data;
  }

  /**
   * 批量获取缓存项
   */
  getBatch<T>(keys: string[]): Array<{ key: string; data: T | undefined }> {
    return keys.map(key => ({
      key,
      data: this.get<T>(key),
    }));
  }

  /**
   * 批量设置缓存项
   */
  setBatch<T>(entries: Array<{ key: string; data: T }>): void {
    entries.forEach(({ key, data }) => {
      this.set(key, data);
    });
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    totalSize: number;
    maxSize: number;
    hitRate: number;
    entries: number;
    maxEntries: number;
  } {
    return {
      size: this.cache.size,
      totalSize: this.totalSize,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
      entries: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.remove(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 根据模式匹配键
   */
  keysMatching(pattern: RegExp): string[] {
    return this.keys().filter(key => pattern.test(key));
  }

  /**
   * 移除匹配模式的缓存项
   */
  removeMatching(pattern: RegExp): number {
    const matchingKeys = this.keysMatching(pattern);
    let removed = 0;
    
    matchingKeys.forEach(key => {
      if (this.remove(key)) {
        removed++;
      }
    });
    
    return removed;
  }

  /**
   * 计算数据大小（粗略估算）
   */
  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16 字符
    }
    
    if (typeof data === 'object') {
      return JSON.stringify(data).length * 2;
    }
    
    return 100; // 默认大小
  }

  /**
   * 驱逐最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTimestamp = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.remove(oldestKey);
    }
  }

  /**
   * 计算缓存命中率（简单实现）
   */
  private calculateHitRate(): number {
    // 这里只是一个简单的实现，实际项目中可能需要更复杂的统计
    return 0.8; // 暂时返回固定值
  }

  /**
   * 序列化缓存到 JSON
   */
  serialize(): string {
    const data = {
      entries: Array.from(this.cache.entries()),
      totalSize: this.totalSize,
      timestamp: Date.now(),
    };
    
    return JSON.stringify(data);
  }

  /**
   * 从 JSON 反序列化缓存
   */
  deserialize(json: string): boolean {
    try {
      const data = JSON.parse(json);
      
      if (!data.entries || !Array.isArray(data.entries)) {
        return false;
      }
      
      this.clear();
      
      for (const [key, entry] of data.entries) {
        this.cache.set(key, entry);
      }
      
      this.totalSize = data.totalSize || 0;
      return true;
    } catch (error) {
      console.error('Failed to deserialize cache:', error);
      return false;
    }
  }
}

// 导出默认实例
export const cache = CacheManager.getInstance();
