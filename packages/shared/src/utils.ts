/**
 * 共享工具函数
 */

import { ErrorType, ErrorResponse, TokenCount } from './types';
import { TOKEN_CONFIG } from './constants';

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(
  type: ErrorType,
  message: string,
  details?: any
): ErrorResponse {
  return {
    type,
    message,
    details,
    timestamp: Date.now(),
  };
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 字节转人类可读格式
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 验证文件扩展名
 */
export function isValidFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return allowedExtensions.includes(ext);
}

/**
 * 清理文件路径
 */
export function sanitizePath(path: string): string {
  return path.replace(/[<>:"|?*]/g, '').replace(/\\/g, '/');
}

/**
 * 计算字符串的哈希值
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 判断是否为有效的 URL
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number, ellipsis = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  const cloned = {} as any;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Token 计算相关工具（临时实现）
 */

// 临时类型定义，等待安装 tiktoken 包
interface Tiktoken {
  encode(text: string): number[];
  decode(tokens: number[]): string;
  free(): void;
}

/**
 * gpt-tok (tiktoken) 的封装，用于计算 tokens
 */
export class GptTok {
  private static encoders: Map<string, Tiktoken> = new Map();

  /**
   * 获取编码器实例
   */
  private static getEncoder(model: string = TOKEN_CONFIG.DEFAULT_MODEL): Tiktoken {
    if (!this.encoders.has(model)) {
      try {
        // TODO: 替换为实际的 tiktoken 导入
        // const encoding = get_encoding(model as any);
        // this.encoders.set(model, encoding);
        throw new Error('tiktoken not implemented yet');
      } catch (error) {
        console.warn(`Failed to load encoding for model ${model}, falling back to default`);
        if (model !== TOKEN_CONFIG.DEFAULT_MODEL) {
          return this.getEncoder(TOKEN_CONFIG.DEFAULT_MODEL);
        }
        throw error;
      }
    }
    return this.encoders.get(model)!;
  }

  /**
   * 计算文本的 token 数量
   */
  static countTokens(text: string, model: string = TOKEN_CONFIG.DEFAULT_MODEL): TokenCount {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text);
      
      return {
        count: tokens.length,
        model,
        text: text.substring(0, 100) // 只保存前100个字符作为预览
      };
    } catch (error) {
      console.warn('Failed to count tokens, using fallback method:', error);
      
      // 回退方案：简单的字符数估算
      // 通常 1 token ≈ 4 个字符（英文）或 2-3 个字符（中文）
      const charCount = text.length;
      const estimatedTokens = Math.ceil(charCount / 3.5); // 保守估计
      
      return {
        count: estimatedTokens,
        model: 'fallback',
        text: text.substring(0, 100)
      };
    }
  }
}

/**
 * 导出便捷函数
 */
export const countTokens = GptTok.countTokens.bind(GptTok);
