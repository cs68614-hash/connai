import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import { MachineInfo, MACHINE_CONFIG, CONFIG_KEYS } from '@connai/shared';

/**
 * 处理最大设备数量限制的逻辑
 */

export class MachineCheck {
  private context: vscode.ExtensionContext;
  private machineId: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.machineId = this.generateMachineId();
  }

  /**
   * 获取当前机器ID
   */
  getMachineId(): string {
    return this.machineId;
  }

  /**
   * 检查机器是否被授权
   */
  async checkMachineAuthorization(): Promise<{
    isAuthorized: boolean;
    machineCount: number;
    maxMachines: number;
    currentMachine?: MachineInfo;
  }> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      
      if (!accessToken) {
        return {
          isAuthorized: false,
          machineCount: 0,
          maxMachines: MACHINE_CONFIG.MAX_MACHINES,
        };
      }

      // TODO: 实现实际的机器检查API调用
      const result = await this.callMachineCheckAPI(accessToken);
      
      return result;
    } catch (error) {
      console.error('Machine authorization check failed:', error);
      return {
        isAuthorized: false,
        machineCount: 0,
        maxMachines: MACHINE_CONFIG.MAX_MACHINES,
      };
    }
  }

  /**
   * 注册当前机器
   */
  async registerMachine(): Promise<boolean> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const machineInfo = this.getMachineInfo();
      
      // TODO: 实现实际的机器注册API调用
      const success = await this.callMachineRegisterAPI(accessToken, machineInfo);
      
      if (success) {
        await this.context.globalState.update(CONFIG_KEYS.MACHINE_ID, this.machineId);
        vscode.window.showInformationMessage('Machine registered successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Machine registration failed:', error);
      vscode.window.showErrorMessage(`Failed to register machine: ${error}`);
      return false;
    }
  }

  /**
   * 取消注册当前机器
   */
  async unregisterMachine(): Promise<boolean> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // TODO: 实现实际的机器取消注册API调用
      const success = await this.callMachineUnregisterAPI(accessToken, this.machineId);
      
      if (success) {
        await this.context.globalState.update(CONFIG_KEYS.MACHINE_ID, undefined);
        vscode.window.showInformationMessage('Machine unregistered successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Machine unregistration failed:', error);
      vscode.window.showErrorMessage(`Failed to unregister machine: ${error}`);
      return false;
    }
  }

  /**
   * 获取用户的所有注册机器
   */
  async getUserMachines(): Promise<MachineInfo[]> {
    try {
      const accessToken = await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN);
      
      if (!accessToken) {
        return [];
      }

      // TODO: 实现实际的获取机器列表API调用
      const machines = await this.callGetMachinesAPI(accessToken);
      
      return machines;
    } catch (error) {
      console.error('Failed to get user machines:', error);
      return [];
    }
  }

  /**
   * 启动定期机器检查
   */
  startMachineCheckTimer(): vscode.Disposable {
    const timer = setInterval(async () => {
      try {
        const authResult = await this.checkMachineAuthorization();
        
        if (!authResult.isAuthorized) {
          vscode.window.showWarningMessage(
            'Machine authorization expired or limit exceeded. Please re-authorize.',
            'Re-authorize'
          ).then(selection => {
            if (selection === 'Re-authorize') {
              this.registerMachine();
            }
          });
        }
      } catch (error) {
        console.error('Machine check timer error:', error);
      }
    }, MACHINE_CONFIG.CHECK_INTERVAL);

    return new vscode.Disposable(() => {
      clearInterval(timer);
    });
  }

  /**
   * 处理机器限制超出的情况
   */
  async handleMachineLimitExceeded(): Promise<void> {
    const machines = await this.getUserMachines();
    
    if (machines.length === 0) {
      vscode.window.showErrorMessage('Unable to retrieve machine list');
      return;
    }

    const items = machines.map(machine => ({
      label: `${machine.hostname} (${machine.platform})`,
      description: `Last seen: ${new Date(machine.lastSeen).toLocaleString()}`,
      machine,
    }));

    const selectedItem = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a machine to unregister',
      title: `You have reached the maximum number of machines (${MACHINE_CONFIG.MAX_MACHINES}). Please unregister one to continue.`,
    });

    if (selectedItem) {
      const confirmed = await vscode.window.showWarningMessage(
        `Are you sure you want to unregister "${selectedItem.machine.hostname}"?`,
        'Yes',
        'No'
      );

      if (confirmed === 'Yes') {
        const success = await this.callMachineUnregisterAPI(
          await this.context.secrets.get(CONFIG_KEYS.AUTH_TOKEN) || '',
          selectedItem.machine.machineId
        );

        if (success) {
          vscode.window.showInformationMessage('Machine unregistered. You can now register this machine.');
          await this.registerMachine();
        }
      }
    }
  }

  /**
   * 生成机器ID
   */
  private generateMachineId(): string {
    // 首先尝试从存储中获取
    const storedId = this.context.globalState.get<string>(CONFIG_KEYS.MACHINE_ID);
    if (storedId) {
      return storedId;
    }

    // 生成新的机器ID
    const machineInfo = this.getMachineInfo();
    const data = `${machineInfo.hostname}-${machineInfo.platform}-${os.userInfo().username}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    
    return hash.substring(0, 16);
  }

  /**
   * 获取机器信息
   */
  private getMachineInfo(): MachineInfo {
    return {
      machineId: this.machineId,
      platform: os.platform(),
      hostname: os.hostname(),
      lastSeen: Date.now(),
    };
  }

  /**
   * 调用机器检查API
   */
  private async callMachineCheckAPI(accessToken: string): Promise<{
    isAuthorized: boolean;
    machineCount: number;
    maxMachines: number;
    currentMachine?: MachineInfo;
  }> {
    try {
      // TODO: 实现实际的API调用
      // const response = await fetch(`${MACHINE_CONFIG.API_ENDPOINT}/machines/check`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     machineId: this.machineId,
      //     machineInfo: this.getMachineInfo(),
      //   }),
      // });

      // const data = await response.json();
      // return data;

      // 临时返回模拟数据
      return {
        isAuthorized: true,
        machineCount: 1,
        maxMachines: MACHINE_CONFIG.MAX_MACHINES,
        currentMachine: this.getMachineInfo(),
      };
    } catch (error) {
      console.error('Machine check API call failed:', error);
      throw error;
    }
  }

  /**
   * 调用机器注册API
   */
  private async callMachineRegisterAPI(accessToken: string, machineInfo: MachineInfo): Promise<boolean> {
    try {
      // TODO: 实现实际的API调用
      // const response = await fetch(`${MACHINE_CONFIG.API_ENDPOINT}/machines/register`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(machineInfo),
      // });

      // return response.ok;

      // 临时返回成功
      return true;
    } catch (error) {
      console.error('Machine register API call failed:', error);
      return false;
    }
  }

  /**
   * 调用机器取消注册API
   */
  private async callMachineUnregisterAPI(accessToken: string, machineId: string): Promise<boolean> {
    try {
      // TODO: 实现实际的API调用
      // const response = await fetch(`${MACHINE_CONFIG.API_ENDPOINT}/machines/${machineId}`, {
      //   method: 'DELETE',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //   },
      // });

      // return response.ok;

      // 临时返回成功
      return true;
    } catch (error) {
      console.error('Machine unregister API call failed:', error);
      return false;
    }
  }

  /**
   * 调用获取机器列表API
   */
  private async callGetMachinesAPI(accessToken: string): Promise<MachineInfo[]> {
    try {
      // TODO: 实现实际的API调用
      // const response = await fetch(`${MACHINE_CONFIG.API_ENDPOINT}/machines`, {
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //   },
      // });

      // const data = await response.json();
      // return data.machines || [];

      // 临时返回模拟数据
      return [
        {
          machineId: this.machineId,
          platform: os.platform(),
          hostname: os.hostname(),
          lastSeen: Date.now(),
        },
      ];
    } catch (error) {
      console.error('Get machines API call failed:', error);
      return [];
    }
  }
}
