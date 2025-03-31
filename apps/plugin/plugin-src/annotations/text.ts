import { BaseAnnotation } from './base';

export class TextAnnotation extends BaseAnnotation {
  public async create(node: SceneNode, text: string = "请输入交互描述..."): Promise<void> {
    try {
      // 增加计数器
      this.state.annotationCounter++;

      // 创建源标注
      const sourceNumber = await this.createSourceAnnotation(node, this.state.annotationCounter);

      // 创建一个 frame 作为输入框容器
      const frame = figma.createFrame();
      frame.name = "标注框";
      frame.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
      frame.strokes = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
      frame.strokeWeight = 1;
      frame.cornerRadius = 8;
      frame.clipsContent = false;
      frame.layoutMode = "VERTICAL";
      frame.primaryAxisSizingMode = "AUTO";
      frame.counterAxisSizingMode = "FIXED";
      frame.counterAxisAlignItems = "MIN";
      frame.primaryAxisAlignItems = "MIN";
      frame.paddingLeft = 16;
      frame.paddingRight = 16;
      frame.paddingTop = 16;
      frame.paddingBottom = 16;

      // 创建文本节点
      const textNode = figma.createText();
      textNode.name = "标注文本";
      textNode.fontSize = 14;
      textNode.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      textNode.characters = text;

      // 设置文本节点大小和行为
      textNode.textAutoResize = "HEIGHT";
      textNode.resize(400 - 32, 400 - 32);
      textNode.textAlignVertical = "TOP";
      textNode.textAlignHorizontal = "LEFT";

      // 将文本添加到 frame 中
      frame.appendChild(textNode);

      // 创建标注框的圆形标记
      const targetNumber = figma.createFrame();
      targetNumber.name = "目标标记";
      targetNumber.resize(24, 24);
      targetNumber.cornerRadius = 12;
      targetNumber.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
      targetNumber.effects = [
        {
          type: "DROP_SHADOW",
          color: { r: 1, g: 1, b: 1, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 4,
          spread: 2,
          visible: true,
          blendMode: "NORMAL",
        },
      ];

      // 创建目标标记的数字
      const targetLabel = figma.createText();
      targetLabel.name = "目标标记数字";
      targetLabel.fontSize = 14;
      targetLabel.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      targetLabel.characters = this.state.annotationCounter.toString();
      targetLabel.textAlignHorizontal = "CENTER";
      targetLabel.textAlignVertical = "CENTER";
      targetLabel.x = (24 - targetLabel.width) / 2;
      targetLabel.y = (24 - targetLabel.height) / 2;

      targetNumber.appendChild(targetLabel);

      // 添加阴影效果
      frame.effects = [
        {
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true,
          blendMode: "NORMAL",
        },
      ];

      // 设置插件数据
      frame.setPluginData("type", "annotation-frame");
      textNode.setPluginData("type", "annotation-text");
      sourceNumber.setPluginData("type", "annotation-number");
      targetNumber.setPluginData("type", "annotation-number");
      frame.setPluginData("annotation-number", this.state.annotationCounter.toString());

      // 设置初始尺寸和位置
      frame.resize(400, 400);
      frame.x = 30;
      frame.y = 0;

      // 设置标注框标记的位置
      targetNumber.x = 0;
      targetNumber.y = 0;

      // 创建一个组来包含标注框和其标记
      const annotationGroup = figma.group(
        [frame, targetNumber],
        figma.currentPage
      );
      annotationGroup.name = `标注组-${this.state.annotationCounter}/${node.name}/${node.id}`;

      // 获取节点的位置和大小
      const bounds = node.absoluteBoundingBox;
      if (!bounds) {
        throw new Error("无法获取节点边界");
      }

      // 设置组的位置和大小
      annotationGroup.resize(430, 400);
      annotationGroup.x = bounds.x + bounds.width + 50;
      annotationGroup.y = bounds.y;

      // 创建一个组来包含源标注
      const sourceGroup = figma.group([sourceNumber], figma.currentPage);
      sourceGroup.name = `源标注组-${this.state.annotationCounter}/${node.name}/${node.id}`;

      // 保存原始节点的引用
      sourceGroup.setPluginData("source-node-id", node.id);
      this.state.setSourceMarker(sourceGroup.id, node.id);

      // 建立双向关联
      sourceGroup.setPluginData("annotation-group-id", annotationGroup.id);
      annotationGroup.setPluginData("source-group-id", sourceGroup.id);

      // 刷新缓存
      this.state.invalidateCache();

      // 监听文本变化以调整高度
      const documentChangeHandler = this.eventManager.debounce((event: DocumentChangeEvent) => {
        if (this.eventManager.isLocalEvent(event)) return;
        const changes = event.documentChanges;

        // 处理文本变化
        const hasTextChange = changes.some(
          (change) =>
            change.type === "PROPERTY_CHANGE" &&
            change.node.id === textNode.id &&
            change.properties.includes("characters")
        );

        if (hasTextChange) {
          // 强制重新计算布局
          frame.layoutMode = "HORIZONTAL";
          frame.layoutMode = "VERTICAL";

          // 确保最小高度
          const contentHeight = textNode.height + 32; // 文本高度 + padding
          const newHeight = Math.max(400, contentHeight);

          // 如果高度需要调整，则调整
          if (frame.height !== newHeight) {
            frame.resize(400, newHeight);
            annotationGroup.resize(430, newHeight);
          }
        }
      }, 100);

      figma.on("documentchange", documentChangeHandler);

      // 监听选择变化
      const selectionChangeHandler = () => {
        const selection = figma.currentPage.selection;
        if (selection.length === 0 || !selection.includes(frame)) {
          if (textNode.characters === "") {
            textNode.characters = "请输入交互描述...";
          }
          // 只移除文本相关的事件监听器
          figma.off("documentchange", documentChangeHandler);
          figma.off("selectionchange", selectionChangeHandler);
        }
      };

      figma.on("selectionchange", selectionChangeHandler);

      // 保存计数器状态
      figma.clientStorage.setAsync("annotationCounter", this.state.annotationCounter);
      figma.notify("标注创建成功");
    } catch (error) {
      console.error("创建文本标注时出错:", error);
    }
  }
} 