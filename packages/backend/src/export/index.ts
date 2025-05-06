import {
  getNodeInfo,
  extractCommentDescription,
  filterHashNodes,
  getNodeExportImage,
  cleanExportData,
  processNodeImageFills,
} from './exportNode';

export { getNodeExportImage };

// 递归处理节点及其子节点
const processNode = async (node: SceneNode, imageDataMap: Map<string, string> = new Map(), keepOriginal: boolean = false) => {
  // 如果是完整版导出，直接返回完整节点信息
  if (keepOriginal) {
    const processedNode = getNodeInfo(node);
    // 处理子节点
    if ('children' in node && node.children) {
      processedNode.children = await Promise.all(
        node.children.map(child => processNode(child, imageDataMap, keepOriginal))
      );
    }
    return processedNode;
  }

  // 如果是COMPONENT_SET节点，返回包含key和属性定义的信息
  if (node.type === 'COMPONENT_SET') {
    const processedNode = getNodeInfo(node);
    processedNode.componentKey = node.key;
    processedNode.componentPropertyDefinitions = node.componentPropertyDefinitions;
    
    // 处理子节点
    if ('children' in node && node.children) {
      processedNode.children = await Promise.all(
        node.children.map(child => processNode(child, imageDataMap))
      );
    }
    return processedNode;
  }

  // 如果是COMPONENT节点，返回包含key的信息
  if (node.type === 'COMPONENT') {
    const processedNode = getNodeInfo(node);
    processedNode.componentKey = node.key;
    
    // 只有当父节点不是COMPONENT_SET时，才添加componentPropertyDefinitions
    if (!node.parent || node.parent.type !== 'COMPONENT_SET') {
      processedNode.componentPropertyDefinitions = node.componentPropertyDefinitions;
    }
    
    // 处理子节点
    if ('children' in node && node.children) {
      processedNode.children = await Promise.all(
        node.children.map(child => processNode(child, imageDataMap))
      );
    }
    return processedNode;
  }

  // 如果是INSTANCE节点，返回简化信息
  if (node.type === 'INSTANCE') {
    const instanceNode = node as InstanceNode;
    // 获取主组件信息
    const mainComponent = await instanceNode.getMainComponentAsync();
    const key = mainComponent?.key || null;
    // 返回简化的INSTANCE节点信息
    return {
      id: instanceNode.id,
      componentId: instanceNode.name,
      componentKey: key,
      type: 'INSTANCE',
      x: instanceNode.x,
      y: instanceNode.y,
      componentProperties: instanceNode.componentProperties || {},
      width: instanceNode.width,
      height: instanceNode.height
    };
  }

  // 如果节点有子节点，递归处理
  if ('children' in node && node.children) {
    const processedNode = getNodeInfo(node);
    
    // 处理节点中的图片填充，加入base64数据
    if (processedNode.fills) {
      processedNode.fills = processedNode.fills.map((fill: any) => {
        if (fill.type === 'IMAGE' && fill.imageHash && imageDataMap.has(fill.imageHash)) {
          return {
            ...fill,
            imageBase64: imageDataMap.get(fill.imageHash)
          };
        }
        return fill;
      });
    }
    
    // 等待所有子节点处理完成
    processedNode.children = await Promise.all(
      node.children.map(child => processNode(child, imageDataMap))
    );
    return processedNode;
  }

  // 其他类型节点直接返回完整信息
  const processedNode = getNodeInfo(node);
  
  // 处理节点中的图片填充，加入base64数据
  if (processedNode.fills) {
    processedNode.fills = processedNode.fills.map((fill: any) => {
      if (fill.type === 'IMAGE' && fill.imageHash && imageDataMap.has(fill.imageHash)) {
        return {
          ...fill,
          imageBase64: imageDataMap.get(fill.imageHash)
        };
      }
      return fill;
    });
  }
  
  return processedNode;
};

export const exportNodes = async (nodes: readonly SceneNode[], optimize: boolean, filterSymbols: boolean = true, keepOriginal: boolean = false) => {
  let description = '';
  const exportedNodes = [];
  const exportedImages = [];
  
  // 收集所有节点中的图片填充数据
  const imageDataMap = new Map<string, string>();
  for (const node of nodes) {
    const nodeImageMap = await processNodeImageFills(node);
    // 合并图片数据
    nodeImageMap.forEach((value, key) => {
      if (!imageDataMap.has(key)) {
        imageDataMap.set(key, value);
      }
    });
  }
  
  // 处理所有节点
  for (const node of nodes) {
    try {
      // 如果是注释节点，提取描述信息
      if (node.name === '#comments') {
        description = extractCommentDescription(node);
        continue;
      }

      // 如果需要过滤且不是#开头的节点，跳过
      if (filterSymbols && !node.name.startsWith('#')) {
        continue;
      }
      
      // 处理节点及其子节点，同时传入图片数据映射
      const processedNode = await processNode(node, imageDataMap, keepOriginal);
      if (processedNode) {
        exportedNodes.push(optimize ? cleanExportData(processedNode) : processedNode);
        exportedImages.push({
          name: node.name,
          id: node.id
        });
      }
    } catch (error) {
      console.error(`处理节点 ${node.name} 时出错:`, error);
    }
  }
  console.log(333, exportedNodes);
  
  return {
    nodesInfo: exportedNodes,
    description,
    images: exportedImages,
    optimize,
    // 输出图片hash到base64的映射，以便在导入时使用
    imageData: Object.fromEntries(imageDataMap)
  }
}