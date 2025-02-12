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
            const instance : InstanceNode = figma.getNodeById(data.id);
            const component = await instance?.getMainComponentAsync();
            
            if (component) {
              // 创建实例
              node = component.createInstance();
              // 保持原有的x和y属性
              if (data.x !== undefined) node.x = data.x;
              if (data.y !== undefined) node.y = data.y;
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

    // Add to parent
    if (parent) {
      parent.appendChild(node);
    }

    // Set geometry and get new bounds for children
    const creator = new BaseNodeCreator();
    const nodeBounds = creator.setGeometry(node, data, parentBounds);

    // Process children
    if (data.children && 'appendChild' in node && data.type !== 'TEXT') {
      // 如果是 instance 节点，使用其自身的位置作为子节点的参考点
      const childParentBounds = data.type === 'INSTANCE' ? {
        x: data.relativeTransform ? data.relativeTransform[0][2] : 0,
        y: data.relativeTransform ? data.relativeTransform[1][2] : 0
      } : nodeBounds;

      for (const childData of data.children) {
        await importNode(childData, node as BaseNode & ChildrenMixin, childParentBounds);
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
export async function importFigmaJSON(jsonData: any): Promise<void> {
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

    // Create a container frame for the imported content
    const containerFrame = figma.createFrame();
    containerFrame.name = jsonData.name || 'Imported Design';
    
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

    // Add padding
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Set container frame size and position
    containerFrame.resize(maxX - minX, maxY - minY);
    containerFrame.x = 0;
    containerFrame.y = 0;
    containerFrame.fills = [];
    
    // Add to current page
    figma.currentPage.appendChild(containerFrame);
    
    // Use minX, minY as offset to convert absolute positions to relative
    const containerBounds = { x: minX, y: minY };
    
    // Import all content
    for (const nodeData of contentToImport) {
      await importNode(nodeData, containerFrame, containerBounds);
    }

    // Select and zoom to the imported content
    figma.currentPage.selection = [containerFrame];
    figma.viewport.scrollAndZoomIntoView([containerFrame]);
    
  } catch (error) {
    console.error('Error importing Figma JSON:', error);
    throw error;
  }
}