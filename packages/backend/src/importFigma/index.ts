import { NodeFactory } from '../nodeFactory';
import { BaseNodeCreator } from '../nodeFactory/baseNodeCreator'

// 添加组件属性类型定义
interface ComponentPropertyDefinition {
  type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
  name: string;
  defaultValue?: string | boolean;
  preferredValues?: Array<{
    type: 'COMPONENT_SET' | 'COMPONENT';
    key: string;
  }>;
}

interface ComponentPropertyDefinitions {
  [key: string]: ComponentPropertyDefinition;
}

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

// 新增：检查节点是否支持layoutSizing属性的辅助函数
function canSetLayoutSizing(node: SceneNode): boolean {
  // 如果节点是自动布局框架，则可以设置
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    return true;
  }
  
  // 如果节点是自动布局框架的子节点，也可以设置
  if (node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE') {
    return true;
  }
  
  return false;
}

// Main function to import nodes - 优化版本
export async function importNode(
  data: any, 
  parent: BaseNode & ChildrenMixin, 
  parentBounds?: { x: number, y: number },
  callback?: (nodeId: string, node: SceneNode, nodeData: any) => void
): Promise<SceneNode | null> {
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
        console.log(1, nodeData);
        
        if (nodeData.componentKey) {
          try {
            // 直接在本地查找组件
            await figma.loadAllPagesAsync();
            const components = figma.root.findAllWithCriteria({
              types: ["COMPONENT"],
            });
            
            // 根据componentKey查找匹配的组件
            const localComponent = components.find(c => c.key === nodeData.componentKey);
            
            if (localComponent) {
              // 使用找到的组件创建实例
              node = localComponent.createInstance();
              console.log(`使用本地组件创建实例: ${localComponent.name}`, node);
              
              // 保持原有的位置属性
              if (nodeData.x !== undefined) node.x = nodeData.x;
              if (nodeData.y !== undefined) node.y = nodeData.y;
              
              // 设置组件属性
              if (nodeData.componentProperties && 'componentProperties' in node) {
                try {
                  // 设置组件属性
                  for (const key in nodeData.componentProperties) {
                    if (key in node.componentProperties) {
                      node.setProperties({ [key]: nodeData.componentProperties[key].value });
                    }
                  }
                } catch (error) {
                  console.warn('Failed to set componentProperties:', error);
                }
              }
            } else {
              // 如果本地未找到，尝试通过ID查找
              try {
                const foundNode = figma.getNodeById(nodeData.id);
                if (foundNode && foundNode.type === 'INSTANCE') {
                  const component = await foundNode.getMainComponentAsync();
                  console.log(11, component);
                  
                  if (component) {
                    // 创建实例
                    node = component.createInstance();
                    // 保持原有的x和y属性
                    if (nodeData.x !== undefined) node.x = nodeData.x;
                    if (nodeData.y !== undefined) node.y = nodeData.y;
                  }
                }
              } catch (error) {
                console.log('Failed to find node by ID:', error);
              }
            }
          } catch (localError) {
            console.error('本地组件查找失败:', localError);
          }
        }
        
        // 如果没有componentKey或导入失败，使用原来的逻辑
        if (!node) {
          const factory = new NodeFactory();
          node = await factory.createNode(nodeData.type, nodeData);
        }
      } 
      // todo：临时注释掉克隆方案，本地已有组件再导入没有意义，后面探索凭空导入团队库组件的方案
      // // 处理COMPONENT_SET节点 - 通过componentKey导入
      // else if (nodeData.type === 'COMPONENT_SET' && nodeData.componentKey) {
      //   console.log(2);
        
      //   // 直接尝试在本地查找组件集
      //   try {
      //     // 确保所有页面都已加载
      //     await figma.loadAllPagesAsync();
          
      //     // 查找所有组件集
      //     const componentSets = figma.root.findAllWithCriteria({
      //       types: ["COMPONENT_SET"],
      //     });
          
      //     // 根据componentKey查找匹配的组件集
      //     const localComponentSet = componentSets.find(cs => cs.key === nodeData.componentKey);
          
      //     if (localComponentSet) {
      //       // 使用找到的组件集
      //       node = localComponentSet.clone();
      //       console.log(`找到本地组件集: ${localComponentSet.name}`);
            
      //       // 保持原有的位置属性
      //       if (nodeData.x !== undefined) node.x = nodeData.x;
      //       if (nodeData.y !== undefined) node.y = nodeData.y;
            
      //       // 设置组件属性
      //       if (nodeData.componentPropertyDefinitions) {
      //         await setComponentProperties(
      //           node as ComponentNode | ComponentSetNode,
      //           nodeData.componentPropertyDefinitions as ComponentPropertyDefinitions
      //         );
      //       }
      //     } else {
      //       console.warn(`未找到匹配的本地组件集，componentKey: ${nodeData.componentKey}`);
      //     }
      //   } catch (localError) {
      //     console.error('本地组件集查找失败:', localError);
      //   }
        
      //   // 如果本地查找失败，使用常规方法创建节点
      //   if (!node) {
      //     const factory = new NodeFactory();
      //     node = await factory.createNode(nodeData.type, nodeData);
          
      //     // 使用通用方法设置组件属性
      //     if (node && nodeData.componentPropertyDefinitions && 
      //         (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
      //       await setComponentProperties(
      //         node as ComponentNode | ComponentSetNode,
      //         nodeData.componentPropertyDefinitions as ComponentPropertyDefinitions
      //       );
      //     }
      //   }
      // }
      // // 处理COMPONENT节点 - 通过componentKey导入
      // else if (nodeData.type === 'COMPONENT' && nodeData.componentKey) {
      //   console.log(3);
        
      //   // 直接尝试在本地查找组件
      //   try {
      //     // 确保所有页面都已加载
      //     await figma.loadAllPagesAsync();
      //     // 查找所有组件
      //     const components = figma.root.findAllWithCriteria({
      //       types: ["COMPONENT"],
      //     });

      //     // 根据componentKey查找匹配的组件
      //     const localComponent = components.find(c => c.key === nodeData.componentKey);
      //     if (localComponent) {
      //       // 使用找到的组件
      //       node = localComponent.clone();
      //       console.log(`找到并克隆本地组件: ${localComponent.name}`);
            
      //       // 保持原有的位置属性
      //       if (nodeData.x !== undefined) node.x = nodeData.x;
      //       if (nodeData.y !== undefined) node.y = nodeData.y;
            
      //       // 设置组件属性
      //       if (nodeData.componentPropertyDefinitions) {
      //         await setComponentProperties(
      //           node as ComponentNode | ComponentSetNode,
      //           nodeData.componentPropertyDefinitions as ComponentPropertyDefinitions
      //         );
      //       }
      //     } else {
      //       console.warn(`未找到匹配的本地组件，componentKey: ${nodeData.componentKey}`);
      //     }
      //   } catch (localError) {
      //     console.error('本地组件查找失败:', localError);
      //   }
        
      //   // 如果本地查找失败，使用常规方法创建节点
      //   if (!node) {
          
      //     const factory = new NodeFactory();
      //     node = await factory.createNode(nodeData.type, nodeData);
          
      //     // 使用通用方法设置组件属性
      //     if (node && nodeData.componentPropertyDefinitions && 
      //         (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
      //       await setComponentProperties(
      //         node as ComponentNode | ComponentSetNode,
      //         nodeData.componentPropertyDefinitions as ComponentPropertyDefinitions
      //       );
      //     }
      //   }
      // }
      else {
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
      
      // 检查是否有comment字段，并调用回调
      if (callback) {
        console.log('nodeData', nodeData)
        callback(nodeData.id, node, nodeData);
      }

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

        // 只有在非INSTANCE时才处理子节点
        // 因为这些节点通过componentKey/clone导入时已经包含了子节点
        if (nodeData.type !== 'INSTANCE') {
          // 将子节点添加到队列
          for (const childData of nodeData.children) {
            queue.push({
              data: childData,
              parent: node as BaseNode & ChildrenMixin,
              parentBounds: childParentBounds,
              isGroupChild: nodeData.type === 'GROUP' // 标记是GROUP的子节点
            });
          }
        } else {
          console.log(`跳过处理 ${nodeData.type} 节点的子元素，因为通过componentKey导入时已包含子节点`);
        }
      }

      // 在所有子节点处理完后，如果当前节点需要设置layout相关属性，再设置它
      if (node && (nodeData.layoutSizingHorizontal || nodeData.layoutSizingVertical)) {
        try {
          const nodeInfo = figma.getNodeById(node.id);
          if (nodeInfo && 'layoutSizingHorizontal' in nodeInfo) {
            if (nodeData.layoutSizingHorizontal) {
              (nodeInfo as any).layoutSizingHorizontal = nodeData.layoutSizingHorizontal;
            }
            if (nodeData.layoutSizingVertical) {
              (nodeInfo as any).layoutSizingVertical = nodeData.layoutSizingVertical;
            }
            if (nodeData.layoutPositioning) {
              (nodeInfo as any).layoutPositioning = nodeData.layoutPositioning;
              (nodeInfo as any).x = nodeData.x;
              (nodeInfo as any).y = nodeData.y;
            }
            if (nodeData.counterAxisSpacing) {
              (nodeInfo as any).counterAxisSpacing = nodeData.counterAxisSpacing;
            }
          }
        } catch (error) {
          console.warn(`[${node.name}] Error setting layoutSizing:`, error);
        }
      }
      
      // 新增：如果节点没有指定宽度或高度，设置为自动布局
      if (node && !nodeData.layoutMode && (nodeData.width === undefined || nodeData.height === undefined)) {
        try {
          // 文本节点只需要设置自适应宽高，不需要设置为自动布局容器
          if (nodeData.type === 'TEXT') {
            // 先检查是否支持设置layoutSizing
            const canSet = canSetLayoutSizing(node);
            if (canSet) {
              console.log(`为文本节点 ${node.name} 设置宽高自适应`);
              
              // 对于文本节点，设置宽高为自适应
              if (nodeData.width === undefined) {
                (node as any).layoutSizingHorizontal = "HUG";
              }
              
              if (nodeData.height === undefined) {
                (node as any).layoutSizingVertical = "HUG";
              }
              
              console.log(`文本节点 ${node.name} 已设置宽高自适应`);
            } else {
              console.log(`文本节点 ${node.name} 不支持设置layoutSizing，需要先设置为自动布局`);
              // 对于不支持直接设置的节点，先将它设置为自动布局框架
              if ('layoutMode' in node) {
                (node as any).layoutMode = "HORIZONTAL";
                (node as any).counterAxisSizingMode = "AUTO";
                
                if (nodeData.width === undefined) {
                  (node as any).layoutSizingHorizontal = "HUG";
                }
                
                if (nodeData.height === undefined) {
                  (node as any).layoutSizingVertical = "HUG";
                }
              }
            }
          }
          // 实例节点只设置自适应宽高，保留原有布局结构
          else if (nodeData.type === 'INSTANCE') {
            // 先设置为自动布局，然后再设置尺寸
            if ('layoutMode' in node) {
              console.log(`为实例节点 ${node.name} 设置自动布局`);
              
              // 先设置为自动布局
              (node as any).layoutMode = "HORIZONTAL";
              (node as any).counterAxisSizingMode = "AUTO";
              
              // 然后设置自适应尺寸
              if (nodeData.width === undefined) {
                console.log(`实例节点 ${node.name} 设置水平自适应`);
                (node as any).layoutSizingHorizontal = "HUG";
              }
              
              if (nodeData.height === undefined) {
                console.log(`实例节点 ${node.name} 设置垂直自适应`);
                (node as any).layoutSizingVertical = "HUG";
              }
            }
          }
          // 非文本/实例节点且支持自动布局，设置为自动布局容器
          else if ('layoutMode' in node) {
            console.log(`为节点 ${node.name} 设置自动布局属性（宽高未指定）`);
            
            // 设置水平自动布局
            (node as any).layoutMode = "HORIZONTAL";
            (node as any).counterAxisSizingMode = "AUTO";
            
            // 设置宽高为自适应
            if (nodeData.width === undefined) {
              (node as any).layoutSizingHorizontal = "HUG";
            }
            
            if (nodeData.height === undefined) {
              (node as any).layoutSizingVertical = "HUG";
            }
            
            // 记录自动布局设置
            console.log(`节点 ${node.name} 已设置为自动布局：水平方向，宽高自适应`);
          }
        } catch (error) {
          console.warn(`[${node.name}] 设置自动布局失败:`, error);
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
            
            // 如果原节点有comments，需要为新的group节点调用comment回调
            if (callback) {
              callback(nodeData.id, group, nodeData);
            }
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
export async function importFigmaJSON(
  jsonData: any, 
  callback?: (nodeId: string, node: SceneNode, nodeData: any) => void
): Promise<SceneNode[]> {
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
      const batchPromises = batch.map(async(nodeData) => 
        await importNode(nodeData, figma.currentPage, { x: minX, y: minY }, callback)
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

// 新增：设置组件属性的通用方法
async function setComponentProperties(
  node: ComponentNode | ComponentSetNode,
  propertyDefinitions: ComponentPropertyDefinitions
): Promise<void> {
  try {
    for (const [propertyName, propertyDef] of Object.entries(propertyDefinitions)) {
      try {
        // 根据不同的属性类型处理
        switch(propertyDef.type) {
          case 'BOOLEAN':
          case 'TEXT':
          case 'INSTANCE_SWAP':
            console.log(123, propertyName);
            
            node.editComponentProperty(propertyName, {
              defaultValue: propertyDef.defaultValue,
            });
            break;
          case 'VARIANT':
            // VARIANT 类型只支持修改 name
            node.editComponentProperty(propertyName, {
              name: propertyDef.name,
              defaultValue: undefined,
              preferredValues: []
            });
            break;
          default:
            console.warn(`不支持的组件属性类型: ${propertyDef.type}`);
        }
      } catch (propError) {
        console.warn(`设置组件属性 ${propertyName} 失败:`, propError);
      }
    }
  } catch (error) {
    console.warn('设置组件属性定义失败:', error);
  }
}