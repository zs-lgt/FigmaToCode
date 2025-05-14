import { Connection } from './connections/connection';
import { PluginState } from './core/state';

export interface Edge {
  id: string
  start: string,
  end: string,
  content: string[],
}

/**
 * 用于在Figma中创建和管理连接线的工厂类
 * 处理节点之间连接关系的创建和更新
 * 提供批量处理连接信息的功能
 */
export class ConnectionFactory {
  /** 用于创建连接线的连接实例 */
  private connection: Connection;
  /** 插件状态实例 */
  private state: PluginState;

  /**
   * 创建一个新的连接线工厂
   * @param connection - 用于创建连接线的连接实例
   */
  constructor(connection: Connection) {
    this.connection = connection;
    this.state = PluginState.getInstance();
  }

  /**
   * 处理连接信息数据并为每对节点创建连接线
   * @param connectionData - 包含连接信息的数据对象，格式为 {sourceId: {targetId: text}}
   */
  public async createConnections(connectionData: Edge[]) {
    for (const edge of connectionData) {
      const { start, end, content } = edge
      const startNode = figma.getNodeById(start) as SceneNode;
      const endNode = figma.getNodeById(end) as SceneNode;

      // 异常处理：起点和终点是同一个节点
      if (start === end) {
        console.warn(`起点与终点重合`);
        continue;
      }

      // 异常处理：找不到目标节点
      if (!startNode || !endNode) {
        console.warn(`关联节点 ID：${start},${end} 未找到`);
        continue;
      }
      console.log(111)
      // 创建连接线
      const connectionGroup = this.connection.create(startNode, endNode, content.join('\n'));
    }
  }
}