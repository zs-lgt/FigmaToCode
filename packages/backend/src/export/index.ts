import {
  getNodeInfo,
  extractCommentDescription,
  filterHashNodes,
  getNodeExportImage,
  cleanExportData,
} from './exportNode';

export { getNodeExportImage };

export const exportNodes = async (nodes: readonly SceneNode[], optimize: boolean, filterSymbols: boolean = true) => {
  // 获取节点信息
  const nodesInfo = nodes.map(node => getNodeInfo(node));
  let description = '';
  let filteredNodes = nodesInfo;
  // 仅保留#开头的节点并提取描述信息
  filterSymbols &&  (filteredNodes = nodesInfo
    .map(node => {
      if (node.name === '#comments') {
        description = extractCommentDescription(node);
      }
      return filterHashNodes(node);
    })
    .filter(node => node !== null && node.name !== '#comments'))

  // 导出节点信息和图片
  const exportedNodes = [];
  // const exportedImages = [];
  const exportedImages = [];

  for (const node of filteredNodes) {
    try {
      // const imageBase64 = await getNodeExportImage(node.id);
      exportedImages.push({
        name: node.name,
        id: node.id
      });
      // 保存节点信息（不包含图片数据）
      const processedNode = optimize ? cleanExportData(node) : node;
      exportedNodes.push(processedNode);
    } catch (error) {
      console.error(`处理节点 ${node.name} 时出错:`, error);
    }
  }
  console.log(description);
  return {
    nodesInfo: exportedNodes,
    description: description,
    // images: exportedImages,
    images: exportedImages,
    optimize,
  }
}