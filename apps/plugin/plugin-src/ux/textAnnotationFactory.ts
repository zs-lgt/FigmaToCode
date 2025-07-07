import { TextAnnotation } from './annotations/text';
import { isArray } from 'lodash'

type UXInfo = {
  hover?: string | null;
  click?: string | null;
} | string | string[];

export interface UxItem {
  id: string
  comments: string[]
  width: number
  height: number
  x: number
  y: number
}

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 用于在Figma中创建和管理文本标注的工厂类
 * 处理UX交互信息的格式化和处理
 * 在设计元素上创建可视化标注
 */
export class TextAnnotationFactory {
  /** 用于创建标注的文本标注实例 */
  private textAnnotation: TextAnnotation;

  /**
   * 创建一个新的文本标注工厂
   * @param textAnnotation - 用于创建标注的文本标注实例
   */
  constructor(textAnnotation: TextAnnotation) {
    this.textAnnotation = textAnnotation;
  }

  /**
   * 将UX交互信息格式化为可读文本
   * @param uxInfo - 要格式化的UX信息（字符串、字符串数组或带有hover/click属性的对象）
   * @returns 用于标注的格式化文本字符串
   */
  private formatInteractionText(uxInfo: UXInfo): string {
    // 如果uxInfo是字符串，直接返回
    if (typeof uxInfo === 'string') {
      return uxInfo;
    }
    // 是数组时用换行拼接
    if (isArray(uxInfo)) {
      return uxInfo.join('/n')
    }
    
    const parts: string[] = [];
    
    if (uxInfo.hover) {
      parts.push(`悬停时：${uxInfo.hover}`);
    }
    
    if (uxInfo.click) {
      // 如果只有click没有hover，并且不是采集了明确的"点击"信息，就直接使用评论文本
      if (!uxInfo.hover && !uxInfo.click.toLowerCase().includes('点击') && !uxInfo.click.toLowerCase().includes('click')) {
        parts.push(uxInfo.click);
      } else {
        parts.push(`点击时：${uxInfo.click}`);
      }
    }
    
    return parts.join('\n\n');
  }

  /**
   * 处理UX信息数据并为每个节点创建标注
   * @param uxInfoData - 将节点ID映射到其UX信息的记录
   */
  public async createAnnotation(uxInfoData: Record<string, UXInfo>) {
    for (const [nodeId, info] of Object.entries(uxInfoData)) {
      const node = figma.getNodeById(nodeId) as unknown as SceneNode;
      // 异常处理：找不到节点
      if (!node) {
        console.warn(`Node with ID ${nodeId} not found`);
        continue;
      }
      
      // 异常处理：跳过没有信息的节点（仅当info是对象且没有hover和click属性时）
      if (typeof info === 'object' && !isArray(info) && !info.hover && !info.click) {
        continue;
      }

      const annotationText = this.formatInteractionText(info);
      await this.textAnnotation.create(node, annotationText);
    }
  }

  /**
   * 处理V2格式的UX信息数据
   * 支持数组和base64图片
   * 在标注之间添加小延迟以防止Figma崩溃
   * @param uxInfoData - 将节点ID映射到其UX信息的记录
   */
  public async createAnnotationV2(uxInfoData: Record<string, UxItem>) {
    for (const [nodeId, info] of Object.entries(uxInfoData)) {
      const node = figma.getNodeById(nodeId) as unknown as SceneNode;
      // 异常处理：找不到的节点
      if (!node) {
        console.warn(`Node with ID ${nodeId} not found`);
        continue;
      }
      const { comments, width, height, x, y } = info;
      await this.textAnnotation.create(node, comments, { width, height, x, y });
      // 每次添加增加一点等待时间，添加太快太多会导致figma崩溃
      await sleep(30);
    }
  }
}
