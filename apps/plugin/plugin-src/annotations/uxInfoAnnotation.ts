import { TextAnnotation } from './text';

type UXInfo = {
  hover?: string | null;
  click?: string | null;
} | string | string[];

interface NodeCache {
  [key: string]: SceneNode;
}
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
export class UXInfoAnnotationManager {
  private textAnnotation: TextAnnotation;
  private nodeCache: NodeCache = {};

  constructor(textAnnotation: TextAnnotation) {
    this.textAnnotation = textAnnotation;
  }

  private formatInteractionText(uxInfo: UXInfo): string {
    // 如果uxInfo是字符串，直接返回
    if (typeof uxInfo === 'string') {
      return uxInfo;
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

  public async processUXInfo(uxInfoData: Record<string, UXInfo>) {
    for (const [nodeId, info] of Object.entries(uxInfoData)) {
      const node = figma.getNodeById(nodeId);
      if (!node) {
        console.warn(`Node with ID ${nodeId} not found`);
        continue;
      }
      
      // 跳过没有信息的节点（仅当info是对象且没有hover和click属性时）
      if (typeof info === 'object' && !info.hover && !info.click) {
        continue;
      }

      const annotationText = this.formatInteractionText(info);
      await this.textAnnotation.create(node, annotationText);
    }
  }

  // 处理UX信息V2版本，支持数组和base64图片
  public async processUXInfoV2(uxInfoData: Record<string, UXInfo>) {
    for (const [nodeId, info] of Object.entries(uxInfoData)) {
      const node = figma.getNodeById(nodeId);
      console.log('node', node);
      if (!node) {
        console.warn(`Node with ID ${nodeId} not found`);
        continue;
      }

      await this.textAnnotation.create(node, info as string[]);
      await sleep(100);
    }
  }
}
