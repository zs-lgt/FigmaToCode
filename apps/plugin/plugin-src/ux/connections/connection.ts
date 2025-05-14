import { PluginState } from '../core/state';
import { EventManager } from '../core/events';

export class Connection {
  private state: PluginState;
  private eventManager: EventManager;

  constructor() {
    this.state = PluginState.getInstance();
    this.eventManager = EventManager.getInstance();
  }

  // 检查节点是否为标注工具创建的节点
  private isAnnotationNode(node: SceneNode): boolean {
    // 通过节点命名开头判断
    return node.name.startsWith("标注组-") || 
           node.name.startsWith("热区标注组-") || 
           node.name.startsWith("源标注组-") ||
           node.name.startsWith("连接线组");
  }

  // 检查所选节点是否可以添加标注
  private validateNode(node: SceneNode): boolean {
    if (this.isAnnotationNode(node)) {
      figma.notify("标注对象暂不支持添加标注");
      return false;
    }
    return true;
  }

  // 计算连接线中点
  private calculateMidPoint(line: VectorNode): { x: number; y: number } {
    if (!line.vectorNetwork || line.vectorNetwork.vertices.length < 2) {
      // 如果没有有效的顶点，则返回线的中心点
      return {
        x: line.x + line.width / 2,
        y: line.y + line.height / 2,
      };
    }

    // 获取所有顶点
    const vertices = line.vectorNetwork.vertices;

    // 找到中间的顶点
    const midIndex = Math.floor(vertices.length / 2);

    // 如果是偶数个顶点，取中间两个顶点的平均值
    if (vertices.length % 2 === 0 && vertices.length > 2) {
      return {
        x: (vertices[midIndex - 1].x + vertices[midIndex].x) / 2,
        y: (vertices[midIndex - 1].y + vertices[midIndex].y) / 2,
      };
    }

    // 如果是奇数个顶点，直接返回中间顶点
    return {
      x: vertices[midIndex].x,
      y: vertices[midIndex].y,
    };
  }

  // 创建正交路径连接线
  private createOrthogonalPath(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number, 
    isHorizontal: boolean
  ): {
    vectorNetwork: VectorNetwork,
    midPoint: { x: number, y: number }
  } {
    // 设置圆角半径
    const cornerRadius = Math.max(8, Math.max(Math.abs(endX - startX), Math.abs(endY - startY)));
    let midPoint: { x: number, y: number };
    let vectorNetwork: VectorNetwork;

    if (isHorizontal) {
      // 水平连接（左右）
      const midX = startX + (endX - startX) * 0.5;
      const midXLeft = startX + (endX - startX) * 0.25;
      const midXRight = startX + (endX - startX) * 0.75;
      
      midPoint = { x: midX, y: startY + (endY - startY) * 0.5 };

      vectorNetwork = {
        vertices: [
          { x: startX, y: startY },
          { x: midXLeft, y: startY, cornerRadius: cornerRadius },
          { x: midXRight, y: endY, cornerRadius: cornerRadius },
          { x: endX, y: endY, strokeCap: 'ARROW_EQUILATERAL' },
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ],
      };
    } else {
      // 垂直连接（上下）
      const midY = startY + (endY - startY) * 0.5;
      const midYTop = startY + (endY - startY) * 0.25;
      const midYBottom = startY + (endY - startY) * 0.75;
      
      midPoint = { x: startX + (endX - startX) * 0.5, y: midY };

      vectorNetwork = {
        vertices: [
          { x: startX, y: startY },
          { x: startX, y: midYTop, cornerRadius: cornerRadius },
          { x: endX, y: midYBottom, cornerRadius: cornerRadius },
          { x: endX, y: endY, strokeCap: 'ARROW_EQUILATERAL' },
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ],
      };
    }

    return { vectorNetwork, midPoint };
  }

  // 添加文本到连接线
  public async addTextToConnection(connectionGroup: GroupNode, text: string): Promise<void> {
    try {
      // 查找现有的文本框frame
      let textFrame = connectionGroup.findOne(
        (node) => node.type === "FRAME" && node.name === "连接线文本框"
      ) as FrameNode;

      // 获取连接线
      const line = connectionGroup.findOne(
        (node) => node.type === "VECTOR" && node.name === "连接线"
      ) as VectorNode;

      if (!line) {
        throw new Error("未找到连接线");
      }

      // 计算中点位置
      const midPoint = this.calculateMidPoint(line);

      if (textFrame) {
        // 查找frame中的文本节点
        let textNode = textFrame.findOne(
          (node) => node.type === "TEXT" && node.name === "连接线文本"
        ) as TextNode;

        if (textNode) {
          // 更新文本内容
          textNode.characters = text;
          // frame会自动调整大小以适应新文本
          textFrame.x = midPoint.x - textFrame.width / 2;
          textFrame.y = midPoint.y - textFrame.height / 2;
          return; // 更新完成后直接返回，不再创建新的文本框
        }
      } else {
        // 创建新的文本节点和文本框
        const textNode = figma.createText();
        textNode.name = "连接线文本";
        textNode.fontSize = 12;
        textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
        textNode.characters = text;

        // 创建frame
        textFrame = figma.createFrame();
        textFrame.name = "连接线文本框";
        textFrame.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
        textFrame.clipsContent = false;
        textFrame.layoutMode = "HORIZONTAL";
        textFrame.primaryAxisSizingMode = "AUTO";
        textFrame.counterAxisSizingMode = "AUTO";
        textFrame.paddingLeft = 5;
        textFrame.paddingRight = 5;
        textFrame.paddingTop = 3;
        textFrame.paddingBottom = 3;
        textFrame.itemSpacing = 0;

        // 将文本添加到frame中
        textFrame.appendChild(textNode);
        // 将frame添加到连接线组
        connectionGroup.appendChild(textFrame);

        // 将frame放在线的中心
        textFrame.x = midPoint.x - textFrame.width / 2;
        textFrame.y = midPoint.y - textFrame.height / 2;
      }
    } catch (error) {
      console.error("添加连接线文本时出错:", error);
    }
  }

  // 创建连接线
  public create(start: SceneNode, end: SceneNode): GroupNode | null {
    try {
      // 添加前置校验
      if (!this.validateNode(start) || !this.validateNode(end)) {
        return null;
      }

      const startBounds = start.absoluteBoundingBox;
      const endBounds = end.absoluteBoundingBox;

      if (!startBounds || !endBounds) {
        throw new Error("无法获取节点边界");
      }

      // 计算中心点
      const startCenterX = startBounds.x + startBounds.width / 2;
      const startCenterY = startBounds.y + startBounds.height / 2;
      const endCenterX = endBounds.x + endBounds.width / 2;
      const endCenterY = endBounds.y + endBounds.height / 2;

      // 确定连接方向（水平或垂直）
      const dx = Math.abs(endCenterX - startCenterX);
      const dy = Math.abs(endCenterY - startCenterY);
      const isHorizontal = dx > dy;

      // 创建连接线
      const line = figma.createVector();
      line.name = "连接线";
      
      // 创建蓝色渐变
      const lightBlue = { r: 0.09, g: 0.79, b: 1, a: 1 }; // #17C9FF
      const darkBlue = { r: 0.09, g: 0.5, b: 1, a: 1 };   // #1780FF
      
      let startX, startY, endX, endY;
      let midPoint: { x: number, y: number };

      if (isHorizontal) {
        // 水平连接（左右）
        const isLeftToRight = startCenterX < endCenterX;

        if (isLeftToRight) {
          startX = startBounds.x + startBounds.width; // 左边节点的右侧
          endX = endBounds.x; // 右边节点的左侧
        } else {
          startX = startBounds.x; // 右边节点的左侧
          endX = endBounds.x + endBounds.width; // 左边节点的右侧
        }

        startY = startBounds.y + startBounds.height / 2;
        endY = endBounds.y + endBounds.height / 2;
      } else {
        // 垂直连接（上下）
        const isTopToBottom = startCenterY < endCenterY;

        startX = startBounds.x + startBounds.width / 2;
        endX = endBounds.x + endBounds.width / 2;

        if (isTopToBottom) {
          startY = startBounds.y + startBounds.height; // 上面节点的底部
          endY = endBounds.y; // 下面节点的顶部
        } else {
          startY = startBounds.y; // 下面节点的顶部
          endY = endBounds.y + endBounds.height; // 上面节点的底部
        }
      }
      
      // 创建正交路径
      const { vectorNetwork, midPoint: pathMidPoint } = this.createOrthogonalPath(
        startX, startY, endX, endY, isHorizontal
      );
      line.vectorNetwork = vectorNetwork;
      midPoint = pathMidPoint;
      
      // 设置渐变方向
      // 计算渐变方向，确保从起点到终点
      let gradientTransform;
      
      // 获取路径的第一个和最后一个点
      const firstPoint = vectorNetwork.vertices[0];
      const lastPoint = vectorNetwork.vertices[vectorNetwork.vertices.length - 1];
      
      // 计算方向向量
      const dirX = lastPoint.x - firstPoint.x;
      const dirY = lastPoint.y - firstPoint.y;
      
      // 根据方向向量设置渐变方向
      if (Math.abs(dirX) > Math.abs(dirY)) {
        // 主要是水平方向
        gradientTransform = dirX > 0 
          ? [[1, 0, 0], [0, 1, 0]] as Transform  // 从左到右
          : [[-1, 0, 1], [0, 1, 0]] as Transform; // 从右到左
      } else {
        // 主要是垂直方向
        gradientTransform = dirY > 0 
          ? [[0, 1, 0], [1, 0, 0]] as Transform  // 从上到下
          : [[0, -1, 1], [1, 0, 0]] as Transform; // 从下到上
      }
      
      // 为线条添加渐变
      line.strokes = [{
        type: "GRADIENT_LINEAR",
        gradientStops: [
          { position: 0, color: darkBlue },
          { position: 1, color: lightBlue }
        ],
        gradientTransform: gradientTransform
      }];
      
      line.strokeWeight = 1.5;
      // line.strokeCap = 'ARROW_EQUILATERAL';
      // line.strokeJoin = 'ROUND';

      // 线条粗细，用于调整箭头位置
      const lineThickness = 1.5;
      
      // 创建起点圆形
      const startCircle = figma.createEllipse();
      startCircle.name = "起点圆形";
      
      // 为起点圆形使用纯色 darkBlue (#1780FF)
      startCircle.fills = [{ 
        type: "SOLID", 
        color: { r: 0.09, g: 0.5, b: 1 } // #1780FF (darkBlue)
      }];
      
      startCircle.resize(10, 10);
      startCircle.x = startX - 5;
      startCircle.y = startY - 5;

      // 添加箭头
      const arrowSize = 12; // 箭头尺寸
      const arrow = figma.createVector();
      arrow.name = "箭头";
      
      // 为箭头使用纯色 #17C9FF
      arrow.fills = [{ 
        type: "SOLID", 
        color: { r: 0.09, g: 0.79, b: 1 } // #17C9FF
      }];

      // 创建文本节点和文本框
      const textNode = figma.createText();
      textNode.name = "连接线文本";
      textNode.fontSize = 12;
      textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      textNode.characters = "请输入";

      // 创建frame
      const textFrame = figma.createFrame();
      textFrame.name = "连接线文本框";
      textFrame.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
      textFrame.clipsContent = false;
      textFrame.layoutMode = "HORIZONTAL";
      textFrame.primaryAxisSizingMode = "AUTO";
      textFrame.counterAxisSizingMode = "AUTO";
      textFrame.paddingLeft = 5;
      textFrame.paddingRight = 5;
      textFrame.paddingTop = 3;
      textFrame.paddingBottom = 3;
      textFrame.itemSpacing = 0;

      // 将文本添加到frame中
      textFrame.appendChild(textNode);

      // 创建组
      const group = figma.group([line, startCircle, textFrame], figma.currentPage);
      group.name = `连接线组 ${start.id} -> ${end.id}`;

      // 设置插件数据
      this.state.safeSetPluginData(group, "startNodeId", start.id);
      this.state.safeSetPluginData(group, "endNodeId", end.id);
      this.state.safeSetPluginData(group, "type", "connection");

      // 刷新缓存
      this.state.invalidateCache();

      // 调整文本框位置
      textFrame.x = midPoint.x - textFrame.width / 2;
      textFrame.y = midPoint.y - textFrame.height / 2;

      return group;
    } catch (error) {
      console.error("创建连接线时出错:", error);
      return null;
    }
  }

  private findConnectionsForNode(node: SceneNode): (GroupNode | FrameNode)[] {
    // 使用缓存获取连接线组
    const connectionGroups = this.state.getConnectionGroups();
    return connectionGroups.filter(
      (n: BaseNode) => {
        try {
          const startNodeId = this.state.safeGetPluginData(n, "startNodeId");
          const endNodeId = this.state.safeGetPluginData(n, "endNodeId");
          return startNodeId === node.id || endNodeId === node.id;
        } catch (error) {
          console.error(`检查连接线节点时出错: ${error instanceof Error ? error.message : '未知错误'}`);
          return false;
        }
      }
    );
  }

  // 更新连接线
  public updateConnections(node: SceneNode): void {
    try {
      if (!node) {
        console.error("更新连接线: 传入的节点为空");
        return;
      }

      // 查找所有相关的连接线
      const connections = this.findConnectionsForNode(node);

      for (const connection of connections) {
        try {
          if (!connection) {
            console.error("连接线对象为空，跳过处理");
            continue;
          }

          // 获取起点和终点节点
          const startNodeId = this.state.safeGetPluginData(connection, "startNodeId");
          const endNodeId = this.state.safeGetPluginData(connection, "endNodeId");

          if (!startNodeId || !endNodeId) {
            console.error("连接线缺少起点或终点ID");
            continue;
          }

          // 安全地获取节点
          let startNode, endNode;
          try {
            startNode = this.state.findNodeById(startNodeId);
            endNode = this.state.findNodeById(endNodeId);
          } catch (nodeError) {
            console.error(`获取节点时出错: ${nodeError instanceof Error ? nodeError.message : '未知错误'}`);
            continue;
          }

          if (!startNode || !endNode) {
            console.error(`无法找到连接线的起点或终点节点: startNode=${!!startNode}, endNode=${!!endNode}`);
            // 删除无效的连接线
            connection.remove();
            continue;
          }

          // 确保节点类型正确
          if (!('absoluteBoundingBox' in startNode) || !('absoluteBoundingBox' in endNode)) {
            console.error("起点或终点节点类型不正确，需要SceneNode类型");
            continue;
          }

          // 保存现有文本信息
          let textContent = "请输入";
          let isVisible = true;
          // TODO: 这里需要优化，避免每次都查找文本框
          try {
            const textFrame = connection.findOne((n: BaseNode) => n.name === "连接线文本框") as FrameNode;
            if (textFrame) {
              const textNode = textFrame.findOne((n: BaseNode) => n.type === "TEXT") as TextNode;
              if (textNode) {
                textContent = textNode.characters;
                isVisible = textNode.visible;
              }
            }
          } catch (textError) {
            console.error("获取文本信息时出错:", textError);
          }

          // 移除旧的连接线
          connection.remove();

          // 创建新的连接线
          const newConnection = this.create(startNode as SceneNode, endNode as SceneNode);
          // TODO: 这里需要优化，避免每次都查找文本框
          if (newConnection) {
            try {
              // 更新文本内容和可见性
              const newTextFrame = newConnection.findOne((n: BaseNode) => n.name === "连接线文本框") as FrameNode;
              if (newTextFrame) {
                const newTextNode = newTextFrame.findOne((n: BaseNode) => n.type === "TEXT") as TextNode;
                if (newTextNode) {
                  newTextNode.characters = textContent;
                  newTextNode.visible = isVisible;
                }
              }
            } catch (textUpdateError) {
              console.error("更新文本内容时出错:", textUpdateError);
            }
          }
        } catch (connectionError) {
          console.error("处理单个连接线时出错:", connectionError);
          continue;
        }
      }
      // TODO: 这里需要优化，避免每次都刷新缓存
    } catch (error) {
      console.error("更新连接线时出错:", error);
    }
  }

  // 开始连接
  public startConnection(): void {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
      figma.notify("请先选择一个对象作为连接线的起点，再点击连接线按钮");
      figma.ui.postMessage({
        type: "connectionNotStart",
      });
      return;
    }

    this.state.sourceNode = selection[0];
    this.state.isConnecting = true;
    
    // 通知UI更新按钮状态
    figma.ui.postMessage({
      type: "connectionStarted"
    });
    
    figma.notify("请选择终点对象完成连接");
  }

  // 完成连接
  public finishConnection(targetNode: SceneNode): void {
    try {
      // 添加前置校验
      if (!this.validateNode(targetNode)) {
        this.state.sourceNode = null;
        this.state.isConnecting = false;
        figma.ui.postMessage({
          type: "connectionComplete",
          success: false
        });
        return;
      }

      // 获取源节点
      const sourceNode = this.state.sourceNode;
      if (!sourceNode) {
        console.log("未找到源节点");
        this.state.sourceNode = null;
        this.state.isConnecting = false;
        figma.ui.postMessage({
          type: "connectionComplete",
          success: false
        });
        return;
      }

      // 检查起始节点是否为同一个节点
      if (sourceNode.id === targetNode.id) {
        figma.notify("连接线首尾不能是同一个对象哦");
        this.state.sourceNode = null;
        this.state.isConnecting = false;
        figma.ui.postMessage({
          type: "connectionComplete",
          success: false
        });
        return;
      }

      // 对源节点也进行校验
      if (!this.validateNode(sourceNode)) {
        this.state.sourceNode = null;
        this.state.isConnecting = false;
        figma.ui.postMessage({
          type: "connectionComplete",
          success: false
        });
        return;
      }

      if (!this.state.sourceNode || !this.state.isConnecting) {
        return;
      }

      // 检查源节点和目标节点是否仍然存在
      if (!this.state.findNodeById(this.state.sourceNode.id)) {
        this.state.sourceNode = null;
        this.state.isConnecting = false;
        
        // 通知UI更新按钮状态
        figma.ui.postMessage({
          type: "connectionComplete",
          success: false
        });
        return;
      }

      if (!this.state.findNodeById(targetNode.id)) {
        this.state.sourceNode = null;
        this.state.isConnecting = false;
        
        // 通知UI更新按钮状态
        figma.ui.postMessage({
          type: "connectionComplete",
          success: false
        });
        return;
      }

      this.create(this.state.sourceNode, targetNode);
      this.state.sourceNode = null;
      this.state.isConnecting = false;
      
      // 通知UI更新按钮状态
      figma.ui.postMessage({
        type: "connectionComplete",
        success: true
      });
    } catch (error) {
      console.error("完成连接时出错:", error);
      this.state.sourceNode = null;
      this.state.isConnecting = false;
      
      // 通知UI更新按钮状态
      figma.ui.postMessage({
        type: "connectionComplete",
        success: false
      });
    }
  }

  // 移除文本编辑UI
  public removeTextEditUI(): void {
    const state = PluginState.getInstance();
    state.isTextEditingMode = false;
    // 使用缓存获取所有文本节点
    const allNodes = state.getAllAnnotationNodes();
    const textNodes = allNodes.filter(
      (node) =>
        node.type === "TEXT" &&
        (node.name === "文本输入提示" ||
          node.getPluginData("type") === "textInputField")
    );

    textNodes.forEach((node) => {
      if (node.type === "TEXT" && node.name === "文本输入提示") {
        node.remove();
      }
    });
  }

  // 切换标注可见性
  public toggleAnnotationsVisibility(forceShow?: boolean): void {
    try {
      // 使用缓存获取所有标注相关的节点
      const state = PluginState.getInstance();
      const annotationNodes = state.getAllAnnotationNodes();
      // 如果没有找到任何标注节点，通知用户
      if (annotationNodes.length === 0) {
        figma.notify("当前页面暂无标注");
        return;
      }

      // 确定目标可见性状态
      let targetVisibility: boolean;
      if (forceShow !== undefined) {
        // 如果指定了强制显示/隐藏，使用指定的值
        targetVisibility = forceShow;
      } else {
        // 否则，检查第一个节点的可见性状态，并切换为相反状态
        // 确保节点存在且有效
        const firstValidNode = annotationNodes.find(node => node && node.id);
        if (!firstValidNode) {
          return;
        }
        targetVisibility = !firstValidNode.visible;
      }

      // 更新所有标注节点的可见性
      for (const node of annotationNodes) {
        try {
          // 确保节点存在且有效
          if (node && node.id && this.state.findNodeById(node.id)) {
            node.visible = targetVisibility;
          }
        } catch (nodeError) {
          console.error(`设置节点可见性时出错: ${nodeError instanceof Error ? nodeError.message : '未知错误'}`);
          // 继续处理其他节点
        }
      }

      // 更新插件状态
      this.state.updateSettings({
        ...this.state.userPluginSettings,
        isAnnotationsVisible: targetVisibility
      });

      // 通知用户
      figma.notify(
        targetVisibility ? "已显示所有标注" : "已隐藏所有标注"
      );

      // 通知 UI 更新可见性状态
      figma.ui.postMessage({
        type: "annotationsVisibilityChanged",
        visible: targetVisibility
      });
    } catch (error) {
      console.error("切换标注可见性时出错:", error);
    }
  }
} 