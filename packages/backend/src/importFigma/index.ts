import { NodeFactory } from '../nodeFactory';
import { BaseNodeCreator } from '../nodeFactory/baseNodeCreator'

// 新增：字体映射表，用于替换找不到的字体
const fontFallbacks: { [key: string]: { family: string, style: string } } = {
  'THS JinRongTi': { family: 'Inter', style: 'Regular' },
  'THS JinRongTi Medium': { family: 'Inter', style: 'Medium' },
  'SF Pro': { family: 'Inter', style: 'Regular' },
  'SF Pro Text': { family: 'Inter', style: 'Regular' },
  'SF Pro Display': { family: 'Inter', style: 'Regular' },
};

// 新增：字体缓存，避免重复加载
export const loadedFonts = new Set<string>();

// 新增：字体替换函数
export function getFallbackFont(family: string, style: string = 'Regular'): { family: string, style: string } {
  // 1. 尝试完全匹配
  const fullKey = `${family} ${style}`;
  if (fontFallbacks[fullKey]) {
    return fontFallbacks[fullKey];
  }

  // 2. 尝试匹配字体族
  if (fontFallbacks[family]) {
    return fontFallbacks[family];
  }

  // 3. 返回默认字体
  return { family: 'Inter', style: style === 'Regular' ? 'Regular' : 'Medium' };
}

// 新增：预加载字体函数
async function preloadFonts(jsonData: any): Promise<void> {
  const fontSet = new Set<string>();
  const fontLoadErrors = new Set<string>();
  
  // 递归收集所有字体
  const collectFonts = (node: any) => {
    // 收集文本节点的字体
    if (node.type === 'TEXT') {
      if (node.fontName) {
        fontSet.add(`${node.fontName.family}:${node.fontName.style}`);
      }
      if (node.style?.fontName) {
        fontSet.add(`${node.style.fontName.family}:${node.style.fontName.style}`);
      }
      
      // 处理文本段落
      if (node.textSegments && Array.isArray(node.textSegments)) {
        for (const segment of node.textSegments) {
          if (segment.fontName) {
            fontSet.add(`${segment.fontName.family}:${segment.fontName.style}`);
          }
        }
      }
    }
    
    // 递归处理子节点
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(collectFonts);
    }
  };
  
  // 处理JSON数据
  if (Array.isArray(jsonData)) {
    jsonData.forEach(collectFonts);
  } else if (jsonData.document?.children) {
    jsonData.document.children.forEach(collectFonts);
  } else {
    collectFonts(jsonData);
  }
  
  // 预加载所有收集到的字体
  const fontLoadPromises: Promise<void>[] = [];
  
  // 始终加载默认字体
  if (!loadedFonts.has('Inter:Regular')) {
    fontLoadPromises.push(figma.loadFontAsync({ family: "Inter", style: "Regular" }));
    loadedFonts.add('Inter:Regular');
  }
  if (!loadedFonts.has('Inter:Medium')) {
    fontLoadPromises.push(figma.loadFontAsync({ family: "Inter", style: "Medium" }));
    loadedFonts.add('Inter:Medium');
  }
  
  // 加载其他字体
  for (const fontKey of fontSet) {
    if (!loadedFonts.has(fontKey)) {
      const [family, style] = fontKey.split(':');
      try {
        // 先检查字体是否可用
        const availableFonts = await figma.listAvailableFontsAsync();
        const fontExists = availableFonts.some(font => 
          font.fontName.family === family && font.fontName.style === style
        );

        if (fontExists) {
          // 如果字体存在，加载它
          const promise = figma.loadFontAsync({ family, style });
          fontLoadPromises.push(promise);
          loadedFonts.add(fontKey);
        } else {
          // 如果字体不存在，使用替代字体
          const fallback = getFallbackFont(family, style);
          const fallbackKey = `${fallback.family}:${fallback.style}`;
          
          if (!loadedFonts.has(fallbackKey)) {
            const promise = figma.loadFontAsync(fallback);
            fontLoadPromises.push(promise);
            loadedFonts.add(fallbackKey);
          }
          
          // 记录字体替换信息
          fontLoadErrors.add(`Font "${family} ${style}" not found, using ${fallback.family} ${fallback.style} instead`);
        }
      } catch (error) {
        console.warn(`Failed to preload font: ${fontKey}`, error);
        // 使用替代字体
        const fallback = getFallbackFont(family, style);
        const fallbackKey = `${fallback.family}:${fallback.style}`;
        
        if (!loadedFonts.has(fallbackKey)) {
          const promise = figma.loadFontAsync(fallback);
          fontLoadPromises.push(promise);
          loadedFonts.add(fallbackKey);
        }
      }
    }
  }
  
  // 并行加载所有字体
  if (fontLoadPromises.length > 0) {
    await Promise.all(fontLoadPromises);
  }
}

// 优化：使用队列代替递归处理节点
interface NodeProcessingTask {
  data: any;
  parent: BaseNode & ChildrenMixin;
  parentBounds?: { x: number, y: number };
  isGroupChild?: boolean; // 标记是否为GROUP的子节点
}

// 新增：跟踪需要转换为GROUP的节点
interface GroupConversionTask {
  frameNode: FrameNode;
  parentNode: BaseNode & ChildrenMixin;
  nodeData: any;
}

// Main function to import nodes - 优化版本
export async function importNode(data: any, parent: BaseNode & ChildrenMixin, parentBounds?: { x: number, y: number }): Promise<SceneNode | null> {
  try {
    // 使用队列处理节点，避免深度递归
    const queue: NodeProcessingTask[] = [{ data, parent, parentBounds }];
    let rootNode: SceneNode | null = null;
    
    // 节点映射表，用于快速查找父节点
    const nodeMap = new Map<string, SceneNode>();
    
    // 跟踪需要转换为GROUP的节点
    const groupConversionTasks: GroupConversionTask[] = [];
    
    // 处理队列中的所有节点
    while (queue.length > 0) {
      const task = queue.shift()!;
      const { data: nodeData, parent: parentNode, parentBounds: bounds, isGroupChild } = task;
      
      // 创建当前节点
      let node: SceneNode | null = null;
      
      // 特殊处理INSTANCE节点
      if (nodeData.type === 'INSTANCE') {
        if (nodeData.componentKey) {
          try {
            // 通过componentKey导入组件
            const component = await figma.importComponentByKeyAsync(nodeData.componentKey);
            if (component) {
              // 创建实例
              node = component.createInstance();
              // 保持原有的x和y属性
              if (nodeData.x !== undefined) node.x = nodeData.x;
              if (nodeData.y !== undefined) node.y = nodeData.y;
            }
          } catch (error) {
            // 兜底方案：本地组件放本地
            try {
              const foundNode = figma.getNodeById(nodeData.id);
              if (foundNode && foundNode.type === 'INSTANCE') {
                const component = await foundNode.getMainComponentAsync();
                if (component) {
                  // 创建实例
                  node = component.createInstance();
                  // 保持原有的x和y属性
                  if (nodeData.x !== undefined) node.x = nodeData.x;
                  if (nodeData.y !== undefined) node.y = nodeData.y;
                }
              }
            } catch (error) {
              console.log(error);
            }
            console.warn(`Failed to import component by key: ${nodeData.componentKey}`, error);
          }
        }
        
        // 如果没有componentKey或导入失败，使用原来的逻辑
        if (!node) {
          const factory = new NodeFactory();
          node = await factory.createNode(nodeData.type, nodeData);
        }
      } else {
        // 其他类型节点使用原来的逻辑
        const factory = new NodeFactory();
        node = await factory.createNode(nodeData.type, nodeData);
      }
      
      if (!node) {
        console.warn(`Failed to create node of type: ${nodeData.type}`);
        continue;
      }

      // 保存根节点引用
      if (rootNode === null && queue.length === 0) {
        rootNode = node;
      }

      // 如果有ID，添加到映射表
      if (nodeData.id) {
        nodeMap.set(nodeData.id, node);
      }

      // Add to parent
      if (parentNode) {
        parentNode.appendChild(node);
      }

      // Now set all properties after the node is added to parent
      const creator = new BaseNodeCreator();
      creator.setBaseProperties(node, nodeData);
      const nodeBounds = creator.setGeometry(node, nodeData, bounds);
      creator.setAppearance(node, nodeData);

      // 如果是GROUP节点，添加到转换任务列表
      if (nodeData.type === 'GROUP' && node.type === 'FRAME') {
        groupConversionTasks.push({
          frameNode: node as FrameNode,
          parentNode: parentNode,
          nodeData: nodeData
        });
      }

      // 将子节点添加到处理队列
      if (nodeData.children && 'appendChild' in node && nodeData.type !== 'TEXT') {
        // 如果是 instance 节点，使用其自身的位置作为子节点的参考点
        const childParentBounds = nodeData.type === 'INSTANCE' ? {
          x: nodeData.relativeTransform ? nodeData.relativeTransform[0][2] : 0,
          y: nodeData.relativeTransform ? nodeData.relativeTransform[1][2] : 0
        } : nodeBounds;

        // 将子节点添加到队列
        for (const childData of nodeData.children) {
          queue.push({
            data: childData,
            parent: node as BaseNode & ChildrenMixin,
            parentBounds: childParentBounds,
            isGroupChild: nodeData.type === 'GROUP' // 标记是GROUP的子节点
          });
        }
      }

      // 在所有子节点处理完后，如果当前节点是FRAME并且需要设置layout相关属性，再设置它
      if (node && (nodeData.layoutSizingHorizontal || nodeData.layoutSizingVertical)) {
        try {
          const nodeInfo = figma.getNodeById(node.id);
          if (nodeInfo) {
            if (nodeData.layoutSizingHorizontal) {
              nodeInfo.layoutSizingHorizontal = nodeData.layoutSizingHorizontal;
            }
            if (nodeData.layoutSizingVertical) {
              nodeInfo.layoutSizingVertical = nodeData.layoutSizingVertical;
            }
            if (nodeData.layoutPositioning) {
              nodeInfo.layoutPositioning = nodeData.layoutPositioning;
              nodeInfo.x = nodeData.x;
              nodeInfo.y = nodeData.y;

            }
          }
        } catch (error) {
          console.warn(`[${node.name}] Error setting layoutSizing:`, error);
        }
      }
    }

    // 所有节点都处理完毕后，执行GROUP转换任务
    for (const task of groupConversionTasks) {
      const { frameNode, parentNode, nodeData } = task;
      
      try {
        const children = [...frameNode.children];
        if (children.length > 0) {
          const group = figma.group(children, parentNode);
          
          // Copy over properties that groups can have
          group.name = frameNode.name;
          group.opacity = frameNode.opacity;
          group.visible = frameNode.visible;
          group.locked = frameNode.locked;
          group.rotation = frameNode.rotation;
          group.x = frameNode.x;
          group.y = frameNode.y;
          
          frameNode.remove();
          
          // 更新根节点引用（如果需要）
          if (rootNode === frameNode) {
            rootNode = group;
          }
          
          // 更新节点映射
          if (nodeData.id) {
            nodeMap.set(nodeData.id, group);
          }
        } else {
          console.log(`[GROUP转换] 无法转换为组，因为没有子节点: ${frameNode.name}`);
        }
      } catch (error) {
        console.error(`[GROUP转换] 转换失败: ${error}`);
        console.warn(`Error converting frame to group: ${error}`);
      }
    }

    return rootNode;
  } catch (error) {
    console.error('Error importing node:', error);
    return null;
  }
}

// Entry point for importing Figma JSON
export async function importFigmaJSON(jsonData: any): Promise<SceneNode[]> {
  try {
    // 性能优化：添加进度反馈
    figma.notify('开始导入JSON数据...', { timeout: 1000 });
    
    // 性能优化：预加载所有字体
    await preloadFonts(jsonData);
    
    // Get the actual content to import (skip document and canvas layers)
    let contentToImport: any[] = [];
    
    if (jsonData.document?.children) {
      // If we have a document, look for actual content in its children
      for (const child of jsonData.document.children) {
        if (child.type === 'CANVAS' && child.children) {
          // If it's a canvas, add its children
          contentToImport.push(...child.children);
        } else {
          // If it's not a canvas, add it directly
          contentToImport.push(child);
        }
      }
    } else if (Array.isArray(jsonData)) {
      contentToImport = jsonData;
    } else {
      contentToImport = [jsonData];
    }

    // Find the bounds of the content
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Helper function to update bounds from absoluteBoundingBox
    const updateBounds = (box: any) => {
      if (box) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + (box.width || 0));
        maxY = Math.max(maxY, box.y + (box.height || 0));
      }
    };

    // Helper function to recursively find bounds
    const findBounds = (node: any) => {
      if (node.absoluteBoundingBox) {
        updateBounds(node.absoluteBoundingBox);
      }
      if (node.children) {
        node.children.forEach(findBounds);
      }
    };

    // Find bounds in the content
    contentToImport.forEach(findBounds);

    // If no bounds found, use default size
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 3000;
      maxY = 2000;
    }

    // 性能优化：批量处理大量节点
    const BATCH_SIZE = 20; // 每批处理的节点数量
    const importedNodes: SceneNode[] = [];
    
    // 分批处理节点
    for (let i = 0; i < contentToImport.length; i += BATCH_SIZE) {
      const batch = contentToImport.slice(i, i + BATCH_SIZE);
      
      // 更新进度通知
      if (contentToImport.length > BATCH_SIZE) {
        figma.notify(`导入进度: ${Math.min(100, Math.round((i / contentToImport.length) * 100))}%`, { timeout: 500 });
      }
      
      // 并行处理一批节点
      const batchPromises = batch.map(nodeData => 
        importNode(nodeData, figma.currentPage, { x: minX, y: minY })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // 收集成功创建的节点
      for (const node of batchResults) {
        if (node) {
          importedNodes.push(node);
        }
      }
    }

    // Select the imported content
    if (importedNodes.length > 0) {
      figma.currentPage.selection = importedNodes;
      figma.viewport.scrollAndZoomIntoView(importedNodes);
      figma.notify(`成功导入 ${importedNodes.length} 个节点`, { timeout: 2000 });
    }
    
    // 返回导入的节点数组
    return importedNodes;
  } catch (error: any) {
    console.error('Error importing Figma JSON:', error);
    figma.notify(`导入失败: ${error.message}`, { error: true });
    throw error;
  }
}