import { cloneNode, convertIntoNodes } from "./altNodes/altConversion";
import {
  retrieveGenericSolidUIColors,
  retrieveGenericLinearGradients as retrieveGenericGradients,
} from "./common/retrieveUI/retrieveColors";
import { flutterMain } from "./flutter/flutterMain";
import { htmlMain } from "./html/htmlMain";
import { swiftuiMain } from "./swiftui/swiftuiMain";
import { tailwindMain } from "./tailwind/tailwindMain";

export type FrameworkTypes = "Flutter" | "SwiftUI" | "HTML" | "Tailwind";

export type PluginSettings = {
  framework: FrameworkTypes;
  jsx: boolean;
  inlineStyle: boolean;
  optimizeLayout: boolean;
  layerName: boolean;
  responsiveRoot: boolean;
  flutterGenerationMode: string;
  swiftUIGenerationMode: string;
  roundTailwindValues: boolean;
  roundTailwindColors: boolean,
  customTailwindColors: boolean,
};

export const run = async (settings: PluginSettings) => {
  // ignore when nothing was selected
  if (figma.currentPage.selection.length === 0) {
    figma.ui.postMessage({
      type: "empty",
    });
    return;
  }
  
  const convertedSelection = convertIntoNodes(
    figma.currentPage.selection,
    null
  );
  let result = "";
  switch (settings.framework) {
    case "HTML":
      result = htmlMain(convertedSelection, settings);
      break;
    case "Tailwind":
      result = tailwindMain(convertedSelection, settings);
      break;
    case "Flutter":
      result = flutterMain(convertedSelection, settings);
      break;
    case "SwiftUI":
      result = swiftuiMain(convertedSelection, settings);
      break;
  }
  figma.ui.postMessage({
    type: "code",
    data: result,
    settings: settings,
    htmlPreview:
      convertedSelection.length > 0
        ? {
            size: convertedSelection.map((node) => ({
              width: node.width,
              height: node.height,
            }))[0],
            content: result,
          }
        : null,
    colors: retrieveGenericSolidUIColors(settings.framework),
    gradients: retrieveGenericGradients(settings.framework),
    preferences: settings,
    // text: retrieveTailwindText(convertedSelection),
  });
};

figma.ui.onmessage = async (msg) => {
  if (msg.type === "export-nodes") {
    const nodes = figma.currentPage.children;
    console.log('节点:', nodes);
    const nodesInfo = nodes.map(getNodeInfo);
    let description = "";
    
    // 仅保留#开头的节点并提取描述信息
    const filteredNodes = nodesInfo
      .map(node => {
        if (node.name === '#comments') {
          description = extractCommentDescription(node);
        }
        return filterHashNodes(node);
      })
      .filter(node => node !== null && node.name !== '#comments');

    // 导出节点信息和图片
    const exportedNodes = [];
    const exportedImages = [];

    for (const node of filteredNodes) {
      try {
        const imageBase64 = await getNodeExportImage(node.id);
        // 保存节点信息（不包含图片数据）
        exportedNodes.push(node);
        // 保存图片数据
        if (imageBase64) {
          exportedImages.push({
            name: node.name,
            data: imageBase64
          });
        }
      } catch (error) {
        console.error(`处理节点 ${node.name} 时出错:`, error);
      }
    }

    // 发送所有数据
    figma.ui.postMessage({
      type: "export-nodes-result",
      data: {
        nodesInfo: JSON.stringify(exportedNodes, null, 2),
        description: description,
        images: exportedImages
      }
    });
  }
  if (msg.type === "export-description") {
    const nodes = figma.currentPage.children;
    console.log('节点:', nodes);
    const nodesInfo = nodes.map(getNodeInfo);
    let description = "";
    // 仅保留#开头的节点
    const filteredNodes = nodesInfo
      .map(node => {
        // 提取 #comments 节点的描述信息
        if (node.name === '#comments') {
          description = extractCommentDescription(node);
        }
        return filterHashNodes(node);
      })
      // 过滤掉空节点以及 #comments 节点
      .filter(node => node !== null && node.name !== '#comments');
    console.log('描述信息:', description);
    // 导出每个节点为base64图片 存放在对应节点信息中
    const filteredNodesInfo = await Promise.all(
      filteredNodes.map(async (node) => {
        // 获取节点的导出图片
        const imageBase64 = await getNodeExportImage(node.id);
        // 添加导出图片信息到节点中
        return {
          ...node,
          exportedImage: imageBase64
        };
      })
    );
    const nodesInfoStr = JSON.stringify(filteredNodesInfo, null, 2);
    
    console.log('JSON字符串:', nodesInfoStr);
    figma.ui.postMessage({
      type: "export-ux",
      data: {
        description: description,
      }
    });
  }
};

/**
 * 获取节点信息
 * @param node 节点
 * @returns 节点信息
 */
function getNodeInfo(node: SceneNode) {
  const nodeInfo: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    opacity: node.opacity,
    visible: node.visible,
    locked: node.locked,
    constraints: node.constraints,
    layoutAlign: node.layoutAlign,
    layoutGrow: node.layoutGrow,
    layoutPositioning: node.layoutPositioning,
    fills: node.fills,
    strokes: node.strokes,
    strokeWeight: node.strokeWeight,
    strokeAlign: node.strokeAlign,
    effects: node.effects,
    blendMode: node.blendMode,
    // 添加新的属性
    absoluteBoundingBox: node.absoluteBoundingBox,
    absoluteRenderBounds: node.absoluteRenderBounds,
    absoluteTransform: node.absoluteTransform,
    backgrounds: node.backgrounds,
    bottomLeftRadius: node.bottomLeftRadius,
    bottomRightRadius: node.bottomRightRadius,
    clipsContent: node.clipsContent,
    cornerRadius: node.cornerRadius,
    cornerSmoothing: node.cornerSmoothing,
    dashPattern: node.dashPattern,
    effectStyleId: node.effectStyleId,
    exportSettings: node.exportSettings,
    fillGeometry: node.fillGeometry,
    fillStyleId: node.fillStyleId,
    gridStyleId: node.gridStyleId,
    guides: node.guides,
    horizontalPadding: node.horizontalPadding,
    isMask: node.isMask,
    layoutGrids: node.layoutGrids,
    layoutMode: node.layoutMode,
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    layoutWrap: node.layoutWrap,
    maxHeight: node.maxHeight,
    maxWidth: node.maxWidth,
    minHeight: node.minHeight,
    minWidth: node.minWidth,
    strokeBottomWeight: node.strokeBottomWeight,
    strokeCap: node.strokeCap,
    strokeGeometry: node.strokeGeometry,
    strokeJoin: node.strokeJoin,
    strokeLeftWeight: node.strokeLeftWeight,
    strokeMiterLimit: node.strokeMiterLimit,
    strokeRightWeight: node.strokeRightWeight,
    strokeStyleId: node.strokeStyleId,
    strokeTopWeight: node.strokeTopWeight,
    strokesIncludedInLayout: node.strokesIncludedInLayout,
    topLeftRadius: node.topLeftRadius,
    topRightRadius: node.topRightRadius,
    verticalPadding: node.verticalPadding
  };

  // 处理特定类型的节点属性
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE') {
    const frameNode = node as FrameNode;
    nodeInfo.layoutMode = frameNode.layoutMode;
    nodeInfo.primaryAxisSizingMode = frameNode.primaryAxisSizingMode;
    nodeInfo.counterAxisSizingMode = frameNode.counterAxisSizingMode;
    nodeInfo.primaryAxisAlignItems = frameNode.primaryAxisAlignItems;
    nodeInfo.counterAxisAlignItems = frameNode.counterAxisAlignItems;
    nodeInfo.counterAxisAlignContent = frameNode.counterAxisAlignContent;
    nodeInfo.counterAxisSpacing = frameNode.counterAxisSpacing;
    nodeInfo.itemReverseZIndex = frameNode.itemReverseZIndex;
    nodeInfo.paddingLeft = frameNode.paddingLeft;
    nodeInfo.paddingRight = frameNode.paddingRight;
    nodeInfo.paddingTop = frameNode.paddingTop;
    nodeInfo.paddingBottom = frameNode.paddingBottom;
    nodeInfo.itemSpacing = frameNode.itemSpacing;
    nodeInfo.numberOfFixedChildren = frameNode.numberOfFixedChildren;
  }

  // 处理文本节点特有属性
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    nodeInfo.characters = textNode.characters;
    nodeInfo.fontSize = textNode.fontSize;
    nodeInfo.fontName = textNode.fontName;
    nodeInfo.textAlignHorizontal = textNode.textAlignHorizontal;
    nodeInfo.textAlignVertical = textNode.textAlignVertical;
    nodeInfo.lineHeight = textNode.lineHeight;
    nodeInfo.letterSpacing = textNode.letterSpacing;
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
function filterHashNodes(nodeInfo: any): any | null {
  // 只检查节点名称是否以#开头
  return nodeInfo.name.startsWith('#') ? nodeInfo : null;
}

/**
 * 从节点中提取 #comment 节点的描述信息
 * @param node - 节点
 * @returns 描述信息
 */
function extractCommentDescription(node: any): string {
  if (!node || !node.children) {
    return '';
  }
  // 提取所有子节点的 name 并拼接
  return node.children
    .map(child => child.name)
    .join('\n');
}

/**
 * 获取节点的导出图片
 * @param nodeId - 节点 ID
 * @returns 图片的 base64 编码字符串
 */
const getNodeExportImage = async (nodeId: string) => {
  try {
    // 获取节点
    const node = figma.getNodeById(nodeId);
    if (!node) return null;

    // 使用节点的导出设置导出图片
    const settings = node.exportSettings[0];
    console.log("[getNodeExportImage] settings:", settings);
    
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