import { NodeFactory } from '../nodeFactory';
import { BaseNodeCreator } from '../nodeFactory/baseNodeCreator'

// Main function to import nodes
export async function importNode(data: any, parent: BaseNode & ChildrenMixin, parentBounds?: { x: number, y: number }): Promise<SceneNode | null> {
  try {
    let node: SceneNode | null = null;

    // 特殊处理INSTANCE节点
    if (data.type === 'INSTANCE') {
      if (data.componentKey) {
        try {
          // 通过componentKey导入组件
          const component = await figma.importComponentByKeyAsync(data.componentKey);
          if (component) {
            // 创建实例
            node = component.createInstance();
            // 保持原有的x和y属性
            if (data.x !== undefined) node.x = data.x;
            if (data.y !== undefined) node.y = data.y;
          }
        } catch (error) {
          // 兜底方案：本地组件放本地
          try {
            const foundNode = figma.getNodeById(data.id);
            if (foundNode && foundNode.type === 'INSTANCE') {
              const component = await foundNode.getMainComponentAsync();
              if (component) {
                // 创建实例
                node = component.createInstance();
                // 保持原有的x和y属性
                if (data.x !== undefined) node.x = data.x;
                if (data.y !== undefined) node.y = data.y;
              }
            }
          } catch (error) {
            console.log(error);
          }
          console.warn(`Failed to import component by key: ${data.componentKey}`, error);
        }
      }
      
      // 如果没有componentKey或导入失败，使用原来的逻辑
      if (!node) {
        const factory = new NodeFactory();
        node = await factory.createNode(data.type, data);
      }
    } else {
      // 其他类型节点使用原来的逻辑
      const factory = new NodeFactory();
      node = await factory.createNode(data.type, data);
    }
    
    if (!node) {
      console.warn(`Failed to create node of type: ${data.type}`);
      return null;
    }

    // Add to parent first
    if (parent) {
      parent.appendChild(node);
    }

    // Now set all properties after the node is added to parent
    const creator = new BaseNodeCreator();
    creator.setBaseProperties(node, data);
    const nodeBounds = creator.setGeometry(node, data, parentBounds);
    creator.setAppearance(node, data);

    // Process children
    if (data.children && 'appendChild' in node && data.type !== 'TEXT') {
      // 如果是 instance 节点，使用其自身的位置作为子节点的参考点
      const childParentBounds = data.type === 'INSTANCE' ? {
        x: data.relativeTransform ? data.relativeTransform[0][2] : 0,
        y: data.relativeTransform ? data.relativeTransform[1][2] : 0
      } : nodeBounds;

      // 先处理所有子节点
      for (const childData of data.children) {
        await importNode(childData, node as BaseNode & ChildrenMixin, childParentBounds);
      }
    }

    // 在所有子节点处理完后，如果当前节点是FRAME并且需要设置layoutSizing，再设置它
    if (node && data.type === 'FRAME' && (data.layoutSizingHorizontal || data.layoutSizingVertical)) {
      try {
        const nodeInfo = figma.getNodeById(node.id) as FrameNode;
        if (nodeInfo && nodeInfo.type === 'FRAME') {
          if (data.layoutSizingHorizontal) {
            nodeInfo.layoutSizingHorizontal = data.layoutSizingHorizontal;
          }
          if (data.layoutSizingVertical) {
            nodeInfo.layoutSizingVertical = data.layoutSizingVertical;
          }
        }
      } catch (error) {
        console.warn(`[${node.name}] Error setting layoutSizing:`, error);
      }
    }

    // Convert frame to group if needed
    if (data.type === 'GROUP' && node.type === 'FRAME') {
      try {
        const children = [...node.children];
        if (children.length > 0) {
          const group = figma.group(children, parent);
          // Copy over properties that groups can have
          group.name = node.name;
          group.opacity = node.opacity;
          group.visible = node.visible;
          group.locked = node.locked;
          group.rotation = node.rotation;
          group.x = node.x;
          group.y = node.y;
          
          node.remove();
          return group;
        }
      } catch (error) {
        console.warn(`Error converting frame to group: ${error}`);
      }
    }

    return node;
  } catch (error) {
    console.error('Error importing node:', error);
    return null;
  }
}

// Entry point for importing Figma JSON
export async function importFigmaJSON(jsonData: any): Promise<SceneNode[]> {
  try {
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

    // Import all content directly to the current page
    const importedNodes: SceneNode[] = [];
    for (const nodeData of contentToImport) {
      const node = await importNode(nodeData, figma.currentPage, { x: minX, y: minY });
      if (node) {
        importedNodes.push(node);
      }
    }

    // Select the imported content
    if (importedNodes.length > 0) {
      figma.currentPage.selection = importedNodes;
      figma.viewport.scrollAndZoomIntoView(importedNodes);
    }
    
    // 返回导入的节点数组
    return importedNodes;
  } catch (error) {
    console.error('Error importing Figma JSON:', error);
    throw error;
  }
}