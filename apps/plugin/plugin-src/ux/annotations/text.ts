import { BaseAnnotation } from './base';

const TEXT_PADDING_Y = 12;
const TEXT_PADDING_X = 16;
const TEXT_DEFAULT_SIZE = 14;
const MIN_FRAME_HEIGHT = TEXT_DEFAULT_SIZE + TEXT_PADDING_Y * 2;
const isBase64 = (str: string): boolean => {
  return /^data:image\/(png|jpeg|jpg|gif|svg|webp|svg\+xml);base64,/.test(str);
}

export class TextAnnotation extends BaseAnnotation {
  public async createMultiContent(frame: FrameNode, content: string[]) {
    for(const item of content) {
      console.log('item', item);
      if (isBase64(item)) {
        // 其他图片格式直接处理
        await this.createImageNode(frame, item);
      } else {
        await this.createTextNode(frame, item);
      }
    }
  }

  public async createImageNode(frame: FrameNode, base64Data: string) {
    try {
      // Remove the data URL prefix to get the base64 string
      const base64String = base64Data.split(',')[1];
      // Convert base64 to array buffer
      const imageData = figma.base64Decode(base64String);
      // Create an image from the array buffer
      const image = await figma.createImage(imageData);
      // 获取图片尺寸
      const imageSize = await image.getSizeAsync();
      console.log('imageSize', imageSize)
      
      // Create rectangle that uses the image as a fill
      const rect = figma.createRectangle();
      rect.name = "标注图片";
      rect.fills = [{
        type: 'IMAGE',
        scaleMode: 'FILL',
        imageHash: image.hash
      }];
      
      // 设置图片尺寸
      if(imageSize.width > 0 && imageSize.height > 0) {
        rect.resize(imageSize.width, imageSize.height);
      }
      // Add the rectangle to the frame
      frame.appendChild(rect);
    } catch (error) {
      console.error("创建图片节点时出错:", error);
    }
  }

  public async createTextNode(frame: FrameNode, text: string) {
    const textNode = figma.createText();
    textNode.name = "标注文本";
    textNode.fontSize = 14;
    textNode.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
    textNode.characters = text;

    // 设置文本节点大小和行为
    textNode.textAutoResize = "HEIGHT";
    textNode.resize(400 - 32, textNode.fontSize + 8);
    textNode.textAlignVertical = "TOP";
    textNode.textAlignHorizontal = "LEFT";
    // 设置文本高度为自适应高度
    textNode.textAutoResize = "HEIGHT";

    // 将文本添加到 frame 中
    frame.appendChild(textNode);
  }


  // 找到节点的根层级
  private findRootParent(node: SceneNode): SceneNode {
    let current = node;
    while (current.parent && current.parent.type !== 'PAGE' && current.parent.type !== 'DOCUMENT') {
      current = current.parent;
    }
    return current;
  }

  /**
   * 调整标注位置以避免重叠
   * @param annotationContainer 标注容器节点
   * @param direction 防重叠方向，'vertical'表示纵向调整，'horizontal'表示横向调整
   * @param step 每次移动的步长（像素）
   */
  private adjustAnnotationPosition(annotationContainer: FrameNode, direction: 'vertical' | 'horizontal' = 'vertical', step: number = 20): void {
    const currentBounds = {
      x: annotationContainer.x,
      y: annotationContainer.y,
      width: annotationContainer.width,
      height: annotationContainer.height
    };
    let hasOverlap = true;
    
    while (hasOverlap) {
      hasOverlap = false;
      // 使用缓存获取所有现有的标注
      const existingAnnotations = this.state.getCategoryNodeCache().textAnnotations
        .filter(node => node.id !== annotationContainer.id);
      for (const existing of existingAnnotations) {
        const existingBounds = {
          x: existing.x,
          y: existing.y,
          width: existing.width,
          height: existing.height
        };
        
        // 检查是否有重叠
        if (this.checkOverlap(currentBounds, existingBounds)) {
          if (direction === 'vertical') {
            // 纵向调整：向下移动
            annotationContainer.y += step;
            currentBounds.y += step;
          } else {
            // 横向调整：向右移动
            annotationContainer.x += step;
            currentBounds.x += step;
          }
          hasOverlap = true;
          break;
        }
      }
    }
  }

  // 检查两个边界框是否重叠
  private checkOverlap(bounds1: { x: number, y: number, width: number, height: number },
                      bounds2: { x: number, y: number, width: number, height: number }): boolean {
    return !(bounds1.x + bounds1.width < bounds2.x ||
             bounds2.x + bounds2.width < bounds1.x ||
             bounds1.y + bounds1.height < bounds2.y ||
             bounds2.y + bounds2.height < bounds1.y);
  }

  public async create(node: SceneNode, text: string | string[] = "请输入交互描述..."): Promise<void> {
    try {
      // 增加计数器
      this.state.annotationCounter++;

      // 创建源标注
      const sourceNumber = await this.createSourceAnnotation(node, this.state.annotationCounter);

      // 创建一个 frame 作为输入框容器
      const frame = figma.createFrame();
      frame.name = "标注框";
      frame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
      frame.strokes = [{ type: "SOLID", color: { r: 0.91, g: 0.91, b: 0.91 } }];
      frame.strokeWeight = 1;
      frame.cornerRadius = 4;
      frame.clipsContent = false;
      frame.layoutMode = "VERTICAL";
      frame.primaryAxisSizingMode = "AUTO";
      frame.counterAxisSizingMode = "AUTO";
      frame.counterAxisAlignItems = "MIN";
      frame.primaryAxisAlignItems = "MIN";
      frame.layoutSizingVertical = "HUG";
      frame.itemSpacing = 8;
      frame.paddingLeft = TEXT_PADDING_X;
      frame.paddingRight = TEXT_PADDING_X;
      frame.paddingTop = TEXT_PADDING_Y;
      frame.paddingBottom = TEXT_PADDING_Y;


      if (typeof text === 'object' && text.length) {
        await this.createMultiContent(frame, text)
      } else {
        // 创建文本节点
        const textNode = figma.createText();
        textNode.name = "标注文本";
        textNode.fontSize = 14;
        textNode.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
        textNode.characters = typeof text === 'string' ? text : text.join('\n');

        // 设置文本节点大小和行为
        textNode.textAutoResize = "HEIGHT";
        textNode.resize(400 - 32, textNode.fontSize + 8);
        textNode.textAlignVertical = "TOP";
        textNode.textAlignHorizontal = "LEFT";
        // 设置文本高度为自适应高度
        textNode.textAutoResize = "HEIGHT";

        // 将文本添加到 frame 中
        frame.appendChild(textNode);
      }

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
      // frame.effects = [
      //   {
      //     type: "DROP_SHADOW",
      //     color: { r: 0, g: 0, b: 0, a: 0.25 },
      //     offset: { x: 0, y: 4 },
      //     radius: 8,
      //     spread: 0,
      //     visible: true,
      //     blendMode: "NORMAL",
      //   },
      // ];

      // 设置插件数据
      frame.setPluginData("type", "annotation-frame");
      // textNode.setPluginData("type", "annotation-text");
      sourceNumber.setPluginData("type", "annotation-number");
      targetNumber.setPluginData("type", "annotation-number");
      frame.setPluginData("annotation-number", this.state.annotationCounter.toString());

      // 设置初始尺寸和位置
      // frame.resize(400, 400);
      frame.x = 30;
      frame.y = 0;

      // 设置标注框标记的位置
      targetNumber.x = 0;
      targetNumber.y = 0;

      // 创建一个frame来包含标注框和其标记
      const annotationContainer = figma.createFrame();
      annotationContainer.name = `标注组-${this.state.annotationCounter}/${node.name}/${node.id}`;
      annotationContainer.fills = [];
      annotationContainer.layoutMode = "HORIZONTAL";
      annotationContainer.primaryAxisSizingMode = "FIXED";
      annotationContainer.counterAxisSizingMode = "FIXED";
      annotationContainer.layoutSizingVertical = 'HUG';
      annotationContainer.layoutSizingHorizontal = 'HUG';
      annotationContainer.itemSpacing = 8;
      
      annotationContainer.clipsContent = false;
      
      // 将标注框和标记添加到frame中
      annotationContainer.appendChild(targetNumber);
      annotationContainer.appendChild(frame);

      // 获取节点的位置和大小
      const bounds = node.absoluteBoundingBox;
      if (!bounds) {
        throw new Error("无法获取节点边界");
      }

      // 节点定位
      // 找到目标节点的根层级
      const rootNode = this.findRootParent(node);
      const rootBounds = {
        x: rootNode.x,
        y: bounds.y,
        width: rootNode.width,
        height: rootNode.height
      };
      // 设置初始位置：根节点右侧20px
      annotationContainer.x = rootBounds.x + rootBounds.width + 20;
      annotationContainer.y = rootBounds.y;
      // 检查并避免与现有标注的重叠
      this.adjustAnnotationPosition(annotationContainer, 'horizontal');

      // 创建一个组来包含源标注
      const sourceGroup = figma.group([sourceNumber], figma.currentPage);
      sourceGroup.name = `源标注组-${this.state.annotationCounter}/${node.name}/${node.id}`;

      // 保存原始节点的引用
      sourceGroup.setPluginData("source-node-id", node.id);
      this.state.setSourceMarker(sourceGroup.id, node.id);

      // 建立双向关联
      sourceGroup.setPluginData("annotation-group-id", annotationContainer.id);
      annotationContainer.setPluginData("source-group-id", sourceGroup.id);

      // 注册到状态管理器的缓存中
      this.state.registerTextAnnotation(annotationContainer, sourceGroup);
      // 刷新缓存
      this.state.invalidateCache();

      // 监听文本变化以调整高度
      // const documentChangeHandler = this.eventManager.debounce((event: DocumentChangeEvent) => {
      //   if (this.eventManager.isLocalEvent(event)) return;
      //   const changes = event.documentChanges;

      //   // 处理文本变化
      //   const hasTextChange = changes.some(
      //     (change) =>
      //       change.type === "PROPERTY_CHANGE" &&
      //       change.node.id === textNode.id &&
      //       change.properties.includes("characters")
      //   );

      //   if (hasTextChange) {
      //     // 强制重新计算布局
      //     frame.layoutMode = "HORIZONTAL";
      //     frame.layoutMode = "VERTICAL";

      //     // 确保最小高度
      //     const contentHeight = textNode.height + 32; // 文本高度 + padding
      //     const newHeight = Math.max(400, contentHeight);

      //     // 如果高度需要调整，则调整
      //     if (frame.height !== newHeight) {
      //       frame.resize(400, newHeight);
      //       annotationGroup.resize(430, newHeight);
      //     }
      //   }
      // }, 100);

      // figma.on("documentchange", documentChangeHandler);

      // // 监听选择变化
      // const selectionChangeHandler = () => {
      //   const selection = figma.currentPage.selection;
      //   if (selection.length === 0 || !selection.includes(frame)) {
      //     if (textNode.characters === "") {
      //       textNode.characters = "请输入交互描述...";
      //     }
      //     // 只移除文本相关的事件监听器
      //     figma.off("documentchange", documentChangeHandler);
      //     figma.off("selectionchange", selectionChangeHandler);
      //   }
      // };

      // figma.on("selectionchange", selectionChangeHandler);

      // // 保存计数器状态
      figma.clientStorage.setAsync("annotationCounter", this.state.annotationCounter);
      // figma.notify("标注创建成功");
    } catch (error) {
      console.error("创建文本标注时出错:", error);
    }
  }
} 