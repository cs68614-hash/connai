// 注意：需要安装 tiktoken 包：npm install tiktoken
// import { get_encoding, Tiktoken } from 'tiktoken';
import { TOKEN_CONFIG, TokenCount } from '@connai/shared';

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
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // 只保留前100字符用于调试
      };
    } catch (error) {
      console.error('Failed to count tokens:', error);
      // 返回估算值（大约每4个字符1个token）
      return {
        count: Math.ceil(text.length / 4),
        model: 'estimated',
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      };
    }
  }

  /**
   * 根据 token 限制截断文本
   */
  static truncateText(
    text: string, 
    maxTokens: number, 
    model: string = TOKEN_CONFIG.DEFAULT_MODEL
  ): { text: string; tokenCount: number; truncated: boolean } {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text);
      
      if (tokens.length <= maxTokens) {
        return {
          text,
          tokenCount: tokens.length,
          truncated: false,
        };
      }

      // 截断 tokens 并解码回文本
      const truncatedTokens = tokens.slice(0, maxTokens);
      const truncatedText = encoder.decode(truncatedTokens);
      
      return {
        text: truncatedText,
        tokenCount: truncatedTokens.length,
        truncated: true,
      };
    } catch (error) {
      console.error('Failed to truncate text:', error);
      // 回退到简单的字符截断
      const estimatedMaxChars = maxTokens * 4;
      const truncated = text.length > estimatedMaxChars;
      
      return {
        text: truncated ? text.substring(0, estimatedMaxChars) : text,
        tokenCount: Math.ceil((truncated ? estimatedMaxChars : text.length) / 4),
        truncated,
      };
    }
  }

  /**
   * 批量计算多个文本的 token 数量
   */
  static countTokensBatch(
    texts: string[], 
    model: string = TOKEN_CONFIG.DEFAULT_MODEL
  ): TokenCount[] {
    return texts.map(text => this.countTokens(text, model));
  }

  /**
   * 获取模型的最大 token 限制
   */
  static getModelLimit(model: string): number {
    const limits: Record<string, number> = {
      'cl100k_base': 4096,
      'o200k_base': 8192,
      'gpt-3.5-turbo': 4096,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
    };
    
    return limits[model] || TOKEN_CONFIG.MAX_TOKENS_PER_REQUEST;
  }

  /**
   * 智能分割文本为多个块，每个块不超过指定 token 数
   */
  static splitTextByTokens(
    text: string,
    maxTokensPerChunk: number,
    overlap: number = 0,
    model: string = TOKEN_CONFIG.DEFAULT_MODEL
  ): Array<{ text: string; tokenCount: number; startIndex: number; endIndex: number }> {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text);
      
      if (tokens.length <= maxTokensPerChunk) {
        return [{
          text,
          tokenCount: tokens.length,
          startIndex: 0,
          endIndex: text.length,
        }];
      }

      const chunks: Array<{ text: string; tokenCount: number; startIndex: number; endIndex: number }> = [];
      let currentIndex = 0;
      
      while (currentIndex < tokens.length) {
        const endIndex = Math.min(currentIndex + maxTokensPerChunk, tokens.length);
        const chunkTokens = tokens.slice(currentIndex, endIndex);
        const chunkText = encoder.decode(chunkTokens);
        
        // 找到chunk在原文中的位置
        const textStartIndex = this.findTextPosition(text, chunkText, chunks.length > 0 ? chunks[chunks.length - 1].endIndex : 0);
        const textEndIndex = textStartIndex + chunkText.length;
        
        chunks.push({
          text: chunkText,
          tokenCount: chunkTokens.length,
          startIndex: textStartIndex,
          endIndex: textEndIndex,
        });
        
        // 移动到下一个块，考虑重叠
        currentIndex = endIndex - overlap;
        if (currentIndex <= 0) {
          currentIndex = endIndex;
        }
      }
      
      return chunks;
    } catch (error) {
      console.error('Failed to split text by tokens:', error);
      // 回退到简单的字符分割
      return this.splitTextByChars(text, maxTokensPerChunk * 4, overlap * 4);
    }
  }

  /**
   * 按字符数简单分割文本（回退方案）
   */
  private static splitTextByChars(
    text: string,
    maxCharsPerChunk: number,
    overlap: number = 0
  ): Array<{ text: string; tokenCount: number; startIndex: number; endIndex: number }> {
    const chunks: Array<{ text: string; tokenCount: number; startIndex: number; endIndex: number }> = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      const endIndex = Math.min(currentIndex + maxCharsPerChunk, text.length);
      const chunkText = text.substring(currentIndex, endIndex);
      
      chunks.push({
        text: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4), // 估算
        startIndex: currentIndex,
        endIndex: endIndex,
      });
      
      currentIndex = endIndex - overlap;
      if (currentIndex <= 0) {
        currentIndex = endIndex;
      }
    }
    
    return chunks;
  }

  /**
   * 在文本中查找子字符串的位置
   */
  private static findTextPosition(text: string, substring: string, startFrom: number = 0): number {
    const index = text.indexOf(substring, startFrom);
    return index >= 0 ? index : startFrom;
  }

  /**
   * 清理编码器缓存
   */
  static clearEncoders(): void {
    for (const encoder of this.encoders.values()) {
      encoder.free();
    }
    this.encoders.clear();
  }

  /**
   * 获取所有支持的模型
   */
  static getSupportedModels(): string[] {
    return Object.values(TOKEN_CONFIG.MODELS);
  }

  /**
   * 检查模型是否支持
   */
  static isModelSupported(model: string): boolean {
    return this.getSupportedModels().includes(model);
  }
}

/**
 * 导出便捷函数
 */
export const countTokens = GptTok.countTokens.bind(GptTok);
export const truncateText = GptTok.truncateText.bind(GptTok);
export const splitTextByTokens = GptTok.splitTextByTokens.bind(GptTok);
