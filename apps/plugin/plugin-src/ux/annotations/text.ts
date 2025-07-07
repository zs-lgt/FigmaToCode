import { BaseAnnotation } from './base';
import { importFigmaJSON} from 'backend/src/importFigma'

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TEXT_PADDING_Y = 12;
const TEXT_PADDING_X = 16;

const isBase64 = (str: string): boolean => {
  return /^data:image\/(png|jpeg|jpg|gif|svg|webp|svg\+xml);base64,/.test(str);
}

const isFigmaNode = (item: any): boolean => {
  return typeof item === 'object' && item.type;
}

export class TextAnnotation extends BaseAnnotation {
  private async createMultiContent(frame: FrameNode, content: string[]) {
    for(const item of content) {
      if (isBase64(item)) {
        // 其他图片格式直接处理
        await this.createImageNode(frame, item);
      } else if (isFigmaNode(item)) {
        const nodes = await importFigmaJSON(item)
        if (nodes && nodes.length) {
          for(const node of nodes) {
            frame.appendChild(node)
          }
        }
      } else {
        await this.createTextNode(frame, item);
      }
    }
  }

  private async createImageNode(frame: FrameNode, base64Data: string) {
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

  private async createTextNode(frame: FrameNode, text: string) {
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

  private createTextContent(frame: FrameNode, text: string) {
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

  private createContentContainer() {
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
    return frame
  }
    

  // 创建目标标记的数字
  private createTargetNumber(name: string, number: number) {
    const targetNumber = figma.createText();
    targetNumber.name = name;
    targetNumber.fontSize = 14;
    targetNumber.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    targetNumber.characters = number.toString();
    targetNumber.textAlignHorizontal = "CENTER";
    targetNumber.textAlignVertical = "CENTER";
    targetNumber.x = (24 - targetNumber.width) / 2;
    targetNumber.y = (24 - targetNumber.height) / 2;
    return targetNumber;
  }

  // 创建标注框的圆形标记
  private createTargetLabel(name: string) {
    const targetLabel = figma.createFrame();
    targetLabel.name = name;
    targetLabel.resize(24, 24);
    targetLabel.cornerRadius = 12;
    targetLabel.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
    targetLabel.effects = [
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
    return targetLabel;
  }

  /**
   * 创建标注框的容器
   */
  createAnnotationContainer(node: SceneNode) {
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
      return annotationContainer;
  }
    
  private getContainerBounds(
    node: SceneNode,
    rootBounds: Bounds,
    bounds?: Partial<Bounds>
  ): Bounds {
    const containerBounds = {
      x: (bounds && typeof bounds.x === 'number') ? bounds.x : (rootBounds.x + rootBounds.width + 20),
      y: (bounds && typeof bounds.y === 'number') ? bounds.y : node.y,
      width: bounds?.width ?? rootBounds.width,
      height: bounds?.height ?? rootBounds.height
    };
    return containerBounds;
  }
  
  public async create(
    node: SceneNode,
    text: string | string[] = "请输入交互描述...",
    customBounds?: Partial<Bounds>
  ): Promise<void> {
    try {
      // 增加计数器
      this.state.annotationCounter++;

      // 创建源标注
      const sourceNumber = await this.createSourceAnnotation(node, this.state.annotationCounter);

      // 创建一个 frame 作为输入框容器
      const contentContainer = this.createContentContainer()

      if (typeof text === 'object' && text.length) {
        await this.createMultiContent(contentContainer, text)
      } else {
        // 拼接文本，创建文本节点
        this.createTextContent(contentContainer, typeof text === 'string' ? text : text.join('\n'));
      }

      // 创建标注框的圆形标记
      const targetLabel = this.createTargetLabel('目标标记');


      // 创建目标标记的数字
      const targetNumber = this.createTargetNumber('目标标记数字', this.state.annotationCounter);

      targetLabel.appendChild(targetNumber);


      // 设置初始尺寸和位置
      contentContainer.x = 30;
      contentContainer.y = 0;

      // 设置标注框标记的位置
      targetLabel.x = 0;
      targetLabel.y = 0;

      // 创建一个frame来包含标注框和其标记
      const annotationContainer = this.createAnnotationContainer(node);
      
      // 将标注框和标记添加到frame中
      annotationContainer.appendChild(targetLabel);
      annotationContainer.appendChild(contentContainer);

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
      const containerBounds = this.getContainerBounds(node, rootBounds, customBounds);
      // 设置初始位置：根节点右侧20px
      annotationContainer.x = containerBounds.x;
      annotationContainer.y = containerBounds.y;
      // 检查并避免与现有标注的重叠
      this.adjustAnnotationPosition(annotationContainer, 'vertical');

      // 创建一个组来包含源标注
      const sourceGroup = figma.group([sourceNumber], figma.currentPage);
      sourceGroup.name = `源标注组-${this.state.annotationCounter}/${node.name}/${node.id}`;

      // 设置插件数据
      contentContainer.setPluginData("type", "annotation-frame");
      // textNode.setPluginData("type", "annotation-text");
      sourceNumber.setPluginData("type", "annotation-number");
      targetNumber.setPluginData("type", "annotation-number");
      contentContainer.setPluginData("annotation-number", this.state.annotationCounter.toString());

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

      // // 保存计数器状态
      figma.clientStorage.setAsync("annotationCounter", this.state.annotationCounter);
      // figma.notify("标注创建成功");
    } catch (error) {
      console.error("创建文本标注时出错:", error);
    }
  }
} 