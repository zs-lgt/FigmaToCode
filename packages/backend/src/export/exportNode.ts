// 需要保留的关键属性列表
export const ESSENTIAL_PROPERTIES = {
  common: ['id', 'name', 'type', 'children'],
  layout: ['x', 'y', 'width', 'height', 'layoutMode', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'padding', 'itemSpacing', 'absoluteBoundingBox', 'counterAxisSpacing', 'layoutWrap'],
  text: ['characters', 'fontSize', 'fontName', 'textAlignHorizontal', 'textAutoResize', 'textCase', 'textDecoration', 'letterSpacing', 'lineHeight'],
  style: ['fills', 'strokes', 'effects', 'cornerRadius', 'strokeWeight'],
  constraints: ['constraints'],
  image: ['imageHash']
};

export const cleanExportData = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 处理数组
  if (Array.isArray(obj)) {
    const cleanArray = obj
      .map(item => cleanExportData(item))
      .filter(item => item !== undefined && item !== null);
    return cleanArray.length ? cleanArray : undefined;
  }

  const cleanObj: any = {};
  
  // 根据节点类型确定需要保留的属性
  const essentialProps = new Set([
    ...ESSENTIAL_PROPERTIES.common,
    ...(obj.type === 'TEXT' ? ESSENTIAL_PROPERTIES.text : []),
    ...(obj.type === 'FRAME' || obj.type === 'GROUP' || obj.type === 'INSTANCE' ? ESSENTIAL_PROPERTIES.layout : []),
    ...(obj.fills?.length > 0 || obj.strokes?.length > 0 ? ESSENTIAL_PROPERTIES.style : []),
    ...(obj.imageHash ? ESSENTIAL_PROPERTIES.image : [])
  ]);

  // 只保留必要的属性
  for (const [key, value] of Object.entries(obj)) {
    if (!essentialProps.has(key)) continue;

    // 跳过空值
    if (value === null || value === undefined) continue;
    if (value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;

    // 处理特殊属性
    if (key === 'style') {
      // 只保留必要的样式属性
      const cleanStyle = {};
      for (const styleKey of ESSENTIAL_PROPERTIES.style) {
        // @ts-ignore
        if (value[styleKey] !== undefined) {
          // @ts-ignore
          cleanStyle[styleKey] = value[styleKey];
        }
      }
      if (Object.keys(cleanStyle).length > 0) {
        cleanObj[key] = cleanStyle;
      }
      continue;
    }

      // 递归清理子属性
    const cleanValue = cleanExportData(value);
      if (cleanValue !== undefined) {
        cleanObj[key] = cleanValue;
      }
    }

  return Object.keys(cleanObj).length ? cleanObj : undefined;
}

// 获取节点信息
// @param node 节点
// @returns 节点信息
export const getNodeInfo = (node: SceneNode) => {
  const nodeInfo: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // 基本属性
  if ('visible' in node) nodeInfo.visible = node.visible;
  if ('opacity' in node) nodeInfo.opacity = node.opacity;
  if ('blendMode' in node) nodeInfo.blendMode = node.blendMode;
  if ('isMask' in node) nodeInfo.isMask = node.isMask;
  if ('effects' in node) nodeInfo.effects = node.effects;
  if ('effectStyleId' in node) nodeInfo.effectStyleId = node.effectStyleId;
  if ('exportSettings' in node) nodeInfo.exportSettings = node.exportSettings;

  // 布局属性
  if ('x' in node) nodeInfo.x = node.x;
  if ('y' in node) nodeInfo.y = node.y;
  if ('width' in node) nodeInfo.width = node.width;
  if ('height' in node) nodeInfo.height = node.height;
  if ('rotation' in node) nodeInfo.rotation = node.rotation;
  if ('layoutAlign' in node) nodeInfo.layoutAlign = node.layoutAlign;
  if ('constrainProportions' in node) nodeInfo.constrainProportions = node.constrainProportions;
  if ('layoutGrow' in node) nodeInfo.layoutGrow = node.layoutGrow;
  if ('layoutPositioning' in node) nodeInfo.layoutPositioning = node.layoutPositioning;
  if ('layoutSizingHorizontal' in node) nodeInfo.layoutSizingHorizontal = node.layoutSizingHorizontal;
  if ('layoutSizingVertical' in node) nodeInfo.layoutSizingVertical = node.layoutSizingVertical;
  if ('maxWidth' in node) nodeInfo.maxWidth = node.maxWidth;
  if ('maxHeight' in node) nodeInfo.maxHeight = node.maxHeight;
  if ('minWidth' in node) nodeInfo.minWidth = node.minWidth;
  if ('minHeight' in node) nodeInfo.minHeight = node.minHeight;

  // 约束属性
  if ('constraints' in node) nodeInfo.constraints = node.constraints;

  // 变换属性
  if ('absoluteBoundingBox' in node) nodeInfo.absoluteBoundingBox = node.absoluteBoundingBox;
  if ('absoluteRenderBounds' in node) nodeInfo.absoluteRenderBounds = node.absoluteRenderBounds;
  if ('absoluteTransform' in node) nodeInfo.absoluteTransform = node.absoluteTransform;

  // 处理特定类型的节点属性
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE') {
    // 如果是组件实例，获取实例(变体)属性
    if (node.type === 'INSTANCE') {
      const instanceNode = node as InstanceNode;
      if ('componentProperties' in instanceNode && 
          instanceNode.componentProperties && 
          Object.keys(instanceNode.componentProperties).length > 0) {
        nodeInfo.componentProperties = instanceNode.componentProperties;
      }
      if ('componentId' in instanceNode && 
          instanceNode.componentId && 
          instanceNode.componentId !== '') {
        nodeInfo.componentId = instanceNode.componentId;
      }
    }
    const frameNode = node as FrameNode;
    nodeInfo.layoutMode = frameNode.layoutMode;
    nodeInfo.primaryAxisSizingMode = frameNode.primaryAxisSizingMode;
    nodeInfo.counterAxisSizingMode = frameNode.counterAxisSizingMode;
    nodeInfo.primaryAxisAlignItems = frameNode.primaryAxisAlignItems;
    nodeInfo.counterAxisAlignItems = frameNode.counterAxisAlignItems;
    nodeInfo.counterAxisAlignContent = frameNode.counterAxisAlignContent;
    nodeInfo.counterAxisSpacing = frameNode.counterAxisSpacing;
    nodeInfo.layoutWrap = frameNode.layoutWrap;
    nodeInfo.itemReverseZIndex = frameNode.itemReverseZIndex;
    nodeInfo.paddingLeft = frameNode.paddingLeft;
    nodeInfo.paddingRight = frameNode.paddingRight;
    nodeInfo.paddingTop = frameNode.paddingTop;
    nodeInfo.paddingBottom = frameNode.paddingBottom;
    nodeInfo.itemSpacing = frameNode.itemSpacing;
    nodeInfo.numberOfFixedChildren = frameNode.numberOfFixedChildren;
    nodeInfo.clipsContent = frameNode.clipsContent;
    nodeInfo.guides = frameNode.guides;
    nodeInfo.layoutGrids = frameNode.layoutGrids;
    nodeInfo.backgrounds = frameNode.backgrounds;
  }

  // 样式属性
  if ('fills' in node) nodeInfo.fills = node.fills;
  if ('strokes' in node) nodeInfo.strokes = node.strokes;
  if ('strokeWeight' in node) nodeInfo.strokeWeight = node.strokeWeight;
  if ('strokeAlign' in node) nodeInfo.strokeAlign = node.strokeAlign;
  if ('strokeCap' in node) nodeInfo.strokeCap = node.strokeCap;
  if ('strokeJoin' in node) nodeInfo.strokeJoin = node.strokeJoin;
  if ('strokeMiterLimit' in node) nodeInfo.strokeMiterLimit = node.strokeMiterLimit;
  if ('strokesIncludedInLayout' in node) nodeInfo.strokesIncludedInLayout = node.strokesIncludedInLayout;
  if ('dashPattern' in node) nodeInfo.dashPattern = node.dashPattern;
  if ('fillStyleId' in node) nodeInfo.fillStyleId = node.fillStyleId;
  if ('strokeStyleId' in node) nodeInfo.strokeStyleId = node.strokeStyleId;
  if ('fillGeometry' in node) nodeInfo.fillGeometry = node.fillGeometry;
  if ('strokeGeometry' in node) nodeInfo.strokeGeometry = node.strokeGeometry;

  // 圆角属性
  if ('cornerRadius' in node) nodeInfo.cornerRadius = node.cornerRadius;
  if ('topLeftRadius' in node) nodeInfo.topLeftRadius = node.topLeftRadius;
  if ('topRightRadius' in node) nodeInfo.topRightRadius = node.topRightRadius;
  if ('bottomLeftRadius' in node) nodeInfo.bottomLeftRadius = node.bottomLeftRadius;
  if ('bottomRightRadius' in node) nodeInfo.bottomRightRadius = node.bottomRightRadius;

  // 文本特有属性
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    nodeInfo.characters = textNode.characters;
    nodeInfo.fontSize = textNode.fontSize;
    nodeInfo.fontName = textNode.fontName;
    nodeInfo.textAlignHorizontal = textNode.textAlignHorizontal;
    nodeInfo.textAlignVertical = textNode.textAlignVertical;
    nodeInfo.textAutoResize = textNode.textAutoResize;
    nodeInfo.textCase = textNode.textCase;
    nodeInfo.textDecoration = textNode.textDecoration;
    nodeInfo.letterSpacing = textNode.letterSpacing;
    nodeInfo.lineHeight = textNode.lineHeight;
    nodeInfo.textStyleId = textNode.textStyleId;
  }

  // 处理子节点
  if ('children' in node) {
    nodeInfo.children = (node as FrameNode).children.map(child => getNodeInfo(child));
  }

  // 过滤掉 undefined 的属性
  Object.keys(nodeInfo).forEach(key => {
    if (nodeInfo[key] === undefined) {
      delete nodeInfo[key];
    }
  });

  return nodeInfo;
}

/**
 * 过滤掉非#开头的最外层节点
 * @param nodeInfo - 节点信息
 * @returns 过滤后的节点信息
 */
export const filterHashNodes = (nodeInfo: any): any | null => {
  // 只检查节点名称是否以#开头
  return nodeInfo.name.startsWith('#') ? nodeInfo : null;
}

/**
 * 从节点中提取 #comment 节点的描述信息
 * @param node - 节点
 * @returns 描述信息
 */
export const extractCommentDescription = (node: any): string => {
  if (!node || !node.children) {
    return '';
  }
  // 提取所有子节点的 name 并拼接
  return node.children
    .map((child: SceneNode) => child.name);
}

/**
 * 获取节点的导出图片
 * @param nodeId - 节点 ID
 * @returns 图片的 base64 编码字符串
 */
export const getNodeExportImage = async (nodeId: string) => {
  try {
    // 获取节点
    const node = figma.getNodeById(nodeId);
    if (!node) return null;

    // 使用节点的导出设置导出图片
    // @ts-ignore
    const settings = node.exportSettings[0];
    
    // @ts-ignore
    const bytes = await node.exportAsync({
      format: settings.format as "PNG" | "JPG" | "SVG" | "PDF",
      constraint: settings.constraint,
      contentsOnly: settings.contentsOnly
    });

    // 转换为 base64
    const base64String = figma.base64Encode(bytes);
    return `data:image/${settings.format.toLowerCase()};base64,${base64String}`;

  } catch (error) {
    console.error('Error exporting node:', error);
    return null;
  }
};