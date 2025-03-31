import { TextAnnotation } from './text';

interface UXInfo {
  hover?: string | null;
  click?: string | null;
}

interface NodeCache {
  [key: string]: SceneNode;
}

export class UXInfoAnnotationManager {
  private textAnnotation: TextAnnotation;
  private nodeCache: NodeCache = {};

  constructor(textAnnotation: TextAnnotation) {
    this.textAnnotation = textAnnotation;
    this.initializeNodeCache();
  }

  private initializeNodeCache() {
    // 初始化缓存，遍历一次所有节点并建立映射
    const traverseNodes = (node: SceneNode) => {
      this.nodeCache[node.id] = node;
      if ("children" in node) {
        (node.children as SceneNode[]).forEach(traverseNodes);
      }
    };
    
    // 从当前页面开始遍历
    figma.currentPage.children.forEach(traverseNodes);
  }

  private formatInteractionText(uxInfo: UXInfo): string {
    const parts: string[] = [];
    
    if (uxInfo.hover) {
      parts.push(`悬停时：${uxInfo.hover}`);
    }
    
    if (uxInfo.click) {
      parts.push(`点击时：${uxInfo.click}`);
    }
    
    return parts.join('\n\n');
  }

  public async processUXInfo(uxInfoData: Record<string, UXInfo>) {
    for (const [nodeId, info] of Object.entries(uxInfoData)) {
      const node = this.nodeCache[nodeId];
      if (!node) {
        console.warn(`Node with ID ${nodeId} not found`);
        continue;
      }

      if (!info.hover && !info.click) {
        continue; // Skip if no interaction info
      }

      const annotationText = this.formatInteractionText(info);
      await this.textAnnotation.create(node, annotationText);
    }
  }
}
