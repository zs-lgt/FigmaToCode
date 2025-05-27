/**
 * 树前序遍历，返回遍历后的根节点，经过遍历与处理后，返回处理后重新构建的树根节点
 * @param root 根节点
 * @param children 获取子节点的函数
 * @param process 处理函数，支持异步
 * @returns 遍历后的根节点，返回Promise
 */
export const preOrderTraverse = async <T, V>(
  root: T, 
  children: (node: T) => T[], 
  process: (node: T, processedChildren: V[]) => Promise<V> | V
): Promise<V> => {
  // 如果根节点为空，返回null
  if (!root) return null as unknown as V;
  
  /**
   * 递归处理节点及其子节点
   * @param node 当前节点
   * @returns 处理后的节点的Promise
   */
  const traverseNode = async (node: T): Promise<V> => {
    // 获取当前节点的所有子节点
    const nodeChildren = children(node);
    
    if (!nodeChildren) return null as unknown as V;
    // 递归处理所有子节点，并获取处理后的子节点数组
    // 使用Promise.all等待所有子节点处理完成
    const processedChildren: V[] = await Promise.all(
      nodeChildren.map(child => traverseNode(child))
    );
    
    // 处理当前节点，并传入处理后的子节点数组
    // 这样可以在process函数中重建树结构
    // 支持同步或异步process函数
    return await process(node, processedChildren);
  };
  
  // 从根节点开始递归处理整个树
  return await traverseNode(root);
};

  