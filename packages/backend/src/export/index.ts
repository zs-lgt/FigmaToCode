import {
  getNodeInfo,
  extractCommentDescription,
  filterHashNodes,
  getNodeExportImage,
  cleanExportData,
} from './exportNode';

export { getNodeExportImage };

// 递归处理节点及其子节点
const processNode = (node: SceneNode, components: { [key: string]: any }) => {
  // 如果是INSTANCE节点，将其存入components
  if (node.type === 'INSTANCE') {
    const instanceNode = node as InstanceNode;
    // 如果这个组件还没有被存储
    if (!components[instanceNode.name]) {
      // 存储完整的节点信息，包括子节点
      const fullNodeInfo = getNodeInfo(instanceNode);
      if ('children' in instanceNode && instanceNode.children) {
        fullNodeInfo.children = instanceNode.children.map(child => 
          getNodeInfo(child)
        );
      }
      components[instanceNode.name] = fullNodeInfo;
    }
    // 返回简化的INSTANCE节点信息
    return {
      id: instanceNode.id,
      componentId: instanceNode.name,
      type: 'INSTANCE',
      x: instanceNode.x,
      y: instanceNode.y,
      componentProperties: instanceNode.componentProperties || {}
    };
  }

  // 如果节点有子节点，递归处理
  if ('children' in node && node.children) {
    const processedNode = getNodeInfo(node);
    processedNode.children = node.children.map(child => 
      processNode(child, components)
    );
    return processedNode;
  }

  // 其他类型节点直接返回完整信息
  return getNodeInfo(node);
};

export const exportNodes = async (nodes: readonly SceneNode[], optimize: boolean, filterSymbols: boolean = true) => {
  let description = '';
  const components: { [key: string]: any } = {};
  const exportedNodes = [];
  const exportedImages = [];

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

      // 处理节点及其子节点
      const processedNode = processNode(node, components);
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
console.log(
  'zhangxian', exportedNodes, components
);

  return {
    nodesInfo: exportedNodes,
    components,
    description,
    images: exportedImages,
    optimize,
  }
}