/**
 * Port scanner utility for finding VS Code ConnAI server
 */

export interface PortScanResult {
  port: number;
  available: boolean;
  isConnAI?: boolean;
  version?: string;
  workspaceInfo?: {
    id: string;
    name: string;
    path: string;
  };
}

export class PortScanner {
  private readonly timeout: number;
  private readonly userAgent: string;

  constructor(timeout = 3000) {
    this.timeout = timeout;
    this.userAgent = 'ConnAI-Browser-Extension/1.0';
  }

  /**
   * 扫描单个端口是否有 ConnAI 服务器
   */
  async scanPort(host: string, port: number): Promise<PortScanResult> {
    const url = `${host}:${port}`;
    
    try {
      // 创建带超时的 fetch 请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const health = await response.json();
        
        // 检查是否是 ConnAI 服务器
        const isConnAI = health.server?.includes('ConnAI') || 
                        health.name?.includes('ConnAI') ||
                        health.version !== undefined;

        return {
          port,
          available: true,
          isConnAI,
          version: health.version,
          workspaceInfo: health.workspace
        };
      } else {
        return {
          port,
          available: true,
          isConnAI: false
        };
      }
    } catch (error) {
      // 端口不可用或连接失败
      return {
        port,
        available: false,
        isConnAI: false
      };
    }
  }

  /**
   * 扫描端口范围寻找 ConnAI 服务器
   */
  async scanRange(
    host: string, 
    startPort: number, 
    endPort: number, 
    concurrency = 5
  ): Promise<PortScanResult[]> {
    const ports = Array.from(
      { length: endPort - startPort + 1 }, 
      (_, i) => startPort + i
    );

    const results: PortScanResult[] = [];
    
    // 分批并行扫描
    for (let i = 0; i < ports.length; i += concurrency) {
      const batch = ports.slice(i, i + concurrency);
      const batchPromises = batch.map(port => this.scanPort(host, port));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 寻找第一个可用的 ConnAI 服务器
   */
  async findConnAIServer(
    host: string = 'http://localhost',
    portRanges: { start: number; end: number }[] = [
      { start: 6718, end: 6817 }, // VS Code 工作区管理器范围
      { start: 8080, end: 8090 }, // 协议服务器范围
      { start: 6797, end: 6797 }, // 常用端口
    ]
  ): Promise<PortScanResult | null> {
    console.log('Scanning for ConnAI servers...');

    for (const range of portRanges) {
      console.log(`Scanning ports ${range.start}-${range.end}...`);
      
      const results = await this.scanRange(host, range.start, range.end);
      const connaiServers = results.filter(r => r.isConnAI);
      
      if (connaiServers.length > 0) {
        // 返回第一个找到的 ConnAI 服务器
        const server = connaiServers[0];
        console.log(`Found ConnAI server on port ${server.port}`);
        return server;
      }
    }

    console.log('No ConnAI servers found');
    return null;
  }

  /**
   * 获取所有可用的 ConnAI 服务器
   */
  async findAllConnAIServers(
    host: string = 'http://localhost',
    portRanges: { start: number; end: number }[] = [
      { start: 6718, end: 6817 }, // VS Code 工作区管理器范围
      { start: 8080, end: 8090 }, // 协议服务器范围
    ]
  ): Promise<PortScanResult[]> {
    const allServers: PortScanResult[] = [];

    for (const range of portRanges) {
      const results = await this.scanRange(host, range.start, range.end, 10);
      const connaiServers = results.filter(r => r.isConnAI);
      allServers.push(...connaiServers);
    }

    return allServers.sort((a, b) => a.port - b.port);
  }

  /**
   * 快速检查常用端口
   */
  async quickScan(host: string = 'http://localhost'): Promise<PortScanResult | null> {
    const commonPorts = [6797, 8080, 6718, 6750, 6780];
    
    console.log('Quick scanning common ports...');
    
    for (const port of commonPorts) {
      const result = await this.scanPort(host, port);
      if (result.isConnAI) {
        console.log(`Quick scan found ConnAI server on port ${port}`);
        return result;
      }
    }

    return null;
  }
}

/**
 * 创建端口扫描器实例
 */
export function createPortScanner(timeout?: number): PortScanner {
  return new PortScanner(timeout);
}

/**
 * 快速查找 ConnAI 服务器的便捷函数
 */
export async function findConnAIServer(host = 'http://localhost'): Promise<PortScanResult | null> {
  const scanner = createPortScanner();
  
  // 先尝试快速扫描
  const quickResult = await scanner.quickScan(host);
  if (quickResult) {
    return quickResult;
  }

  // 如果快速扫描没找到，进行完整扫描
  return scanner.findConnAIServer(host);
}
