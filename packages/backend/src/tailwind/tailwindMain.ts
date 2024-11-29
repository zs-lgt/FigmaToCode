import { retrieveTopFill } from "../common/retrieveFill";
import { indentString } from "../common/indentString";
import { tailwindVector } from "./vector";
import { TailwindTextBuilder } from "./tailwindTextBuilder";
import { TailwindDefaultBuilder } from "./tailwindDefaultBuilder";
import { PluginSettings } from "../code";
import { tailwindAutoLayoutProps } from "./builderImpl/tailwindAutoLayout";
import { commonSortChildrenWhenInferredAutoLayout } from "../common/commonChildrenOrder";
import { getClass, type NodeInfo } from './getClass';

export let localTailwindSettings: PluginSettings;

let previousExecutionCache: { style: string; text: string }[];

const selfClosingTags = ["img"];

// 在文件顶部添加一个 Promise 来处理异步的图片上传
let imageUploadPromise: Promise<string>;

export const tailwindMain = (
  sceneNode: Array<SceneNode>,
  settings: PluginSettings
): string => {
  localTailwindSettings = settings;
  previousExecutionCache = [];

  let result = tailwindWidgetGenerator(sceneNode, localTailwindSettings.jsx);

  // remove the initial \n that is made in Container.
  if (result.length > 0 && result.startsWith("\n")) {
    result = result.slice(1, result.length);
  }

  return result;
};

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
// 图片节点处理
const imageNodeHandler = async (node: SceneNode) => {
  switch (node.type) {
    case "RECTANGLE":
    case "ELLIPSE":
      if (node.isAsset) {
        node.fills.forEach(async (fill) => {
          if (fill.type === "IMAGE") {
            const imageHash = fill.imageHash;
            const imgFile = figma.getImageByHash(imageHash);
            try {
              // 获取图片的二进制数据
              const imageBytes = await imgFile.getBytesAsync();
              // 将图片二进制文件转成base64 格式
              const base64Image = `data:image/png;base64,${figma.base64Encode(imageBytes)}`;
              // 发送消息到 UI 层处理网络请求
              // 创建一个新的 Promise 来等待上传结果
              imageUploadPromise = new Promise((resolve) => {
                // 监听来自 UI 的消息
                figma.ui.onmessage = (msg) => {
                  if (msg.type === 'upload-image-complete') {
                    resolve(msg.imageUrl);
                  }
                };
                
                // 发送消息到 UI
                figma.ui.postMessage({
                  type: 'upload-image',
                  base64Image: base64Image,
                  nodeId: node.id,
                });
              });
              
              // 等待上传完成并获取URL
              const imageUrl = await imageUploadPromise;
              // 使用返回的图片URL更新组件
              // builder.addAttributes(`bg-[url(${imageUrl})]`);
            } catch (error) {
              console.error('图片处理失败:', error);
            }
          }
        });
      }
      break;
    case "INSTANCE":
    case "VECTOR":
      
      const imageData = await getNodeExportImage(node.id);
      const classesString = getClass(node);
      const imageUrl = await uploadImageToUI(imageData, node.id, classesString);
      break;
    case "FRAME":
    case "GROUP":
      if (node?.exportSettings?.length > 0) {
        const imageData = await getNodeExportImage(node.id);
        const classesString = getClass(node);
        const imageUrl = await uploadImageToUI(imageData, node.id, classesString);
        
      }
      break;
    default:
      break;
  }
  
}

// 添加新的图片上传函数
const uploadImageToUI = async (imageData: string | null, nodeId: string, classesString?: string): Promise<string> => {
  if (!imageData) return '';
  
  return new Promise((resolve) => {
    figma.ui.onmessage = (msg) => {
      if (msg.type === 'upload-image-complete') {
        resolve(msg.imageUrl);
      }
    };

    figma.ui.postMessage({
      type: 'upload-image',
      base64Image: imageData,
      nodeId: nodeId,
      classesString: classesString,
    });
  });
};

// todo：代码检查想法：将 BorderRadius.only(topleft: 8, topRight: 8) 替换为 BorderRadius.horizontal(8)
const tailwindWidgetGenerator = (
  sceneNode: ReadonlyArray<SceneNode>,
  isJsx: boolean
): string => {
  let comp = "";

  // 过滤不可见节点。这一步是必要的，因为转换已经发生。
  const visibleSceneNode = sceneNode.filter((d) => d.visible);
  visibleSceneNode.forEach((node) => {
    // 图片节点处理
    imageNodeHandler(node);
    switch (node.type) {
      case "RECTANGLE":
      case "ELLIPSE":
        comp += tailwindContainer(node, "", "", isJsx);
        break;
      case "GROUP":
        comp += tailwindGroup(node, isJsx);
        break;
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
      case "COMPONENT_SET":
        comp += tailwindFrame(node, isJsx);
        break;
      case "TEXT":
        comp += tailwindText(node, isJsx);
        break;
      case "LINE":
        comp += tailwindLine(node, isJsx);
        break;
      case "SECTION":
        comp += tailwindSection(node, isJsx);
        break;
      case "VECTOR":
        // 如果node的id是I开头的，则跳过
        if (node.id.startsWith("I")) {
          break;
        }
        comp += tailwindContainer(node, "", "", isJsx);
        break;
    }
  });

  return comp;
};

const tailwindGroup = (node: GroupNode, isJsx: boolean = false): string => {
  // 当尺寸为零或更小时忽略视图
  // 虽然技术上不应该小于0，但由于舍入误差，
  // 它可能会得到类似：-0.000004196293048153166 的值
  // 同时如果内部没有子元素，这也没有意义，所以也要忽略
  if (node.width < 0 || node.height <= 0 || node.children.length === 0) {
    return "";
  }

  // 如果存在导出设置，只返回容器节点，不处理子节点
  if (node?.exportSettings?.length > 0) {
    const builder = new TailwindDefaultBuilder(
      node,
      localTailwindSettings.layerName,
      isJsx
    )
      .blend(node)
      .size(node, localTailwindSettings.optimizeLayout)
      .position(node, localTailwindSettings.optimizeLayout);

    const attr = builder.build("");
    return `\n<div id="${node.id}"${attr}></div>`;
  }

  const vectorIfExists = tailwindVector(
    node,
    localTailwindSettings.layerName,
    "",
    isJsx
  );
  
  if (vectorIfExists) return vectorIfExists;
  // this needs to be called after CustomNode because widthHeight depends on it
  const builder = new TailwindDefaultBuilder(
    node,
    localTailwindSettings.layerName,
    isJsx
  )
    .blend(node)
    .size(node, localTailwindSettings.optimizeLayout)
    .position(node, localTailwindSettings.optimizeLayout);

  if (builder.attributes || builder.style) {
    const attr = builder.build("");

    const generator = tailwindWidgetGenerator(node.children, isJsx);

    return `\n<div${attr}>${indentString(generator)}\n</div>`;
  }

  return tailwindWidgetGenerator(node.children, isJsx);
};

export const tailwindText = (node: TextNode, isJsx: boolean): string => {
  let layoutBuilder = new TailwindTextBuilder(
    node,
    localTailwindSettings.layerName,
    isJsx
  )
    .commonPositionStyles(node, localTailwindSettings.optimizeLayout)
    .textAlign(node);

  const styledHtml = layoutBuilder.getTextSegments(node.id);
  previousExecutionCache.push(...styledHtml);

  let content = "";
  if (styledHtml.length === 1) {
    layoutBuilder.addAttributes(styledHtml[0].style);
    content = styledHtml[0].text;
  } else {
    content = styledHtml
      .map((style) => `<span class="${style.style}">${style.text}</span>`)
      .join("");
  }

  return `\n<div${layoutBuilder.build()}>${content}</div>`;
};

const tailwindFrame = (
  node: FrameNode | InstanceNode | ComponentNode | ComponentSetNode,
  isJsx: boolean
): string => {
  // 如果存在导出设置并且非图片，只返回容器节点，不处理子节点
  if (node?.exportSettings?.length > 0 && node.isAsset) {
    const builder = new TailwindDefaultBuilder(
      node,
      localTailwindSettings.layerName,
      isJsx
    )
      .blend(node)
      .size(node, localTailwindSettings.optimizeLayout)
      .position(node, localTailwindSettings.optimizeLayout);

    const attr = builder.build("");
    return `\n<div id="${node.id}"${attr}></div>`;
  }
  const childrenStr = tailwindWidgetGenerator(
    commonSortChildrenWhenInferredAutoLayout(
      node,
      localTailwindSettings.optimizeLayout
    ),
    isJsx
  );

  if (node.layoutMode !== "NONE") {
    const rowColumn = tailwindAutoLayoutProps(node, node);
    return tailwindContainer(node, childrenStr, rowColumn, isJsx);
  } else {
    if (localTailwindSettings.optimizeLayout && node.inferredAutoLayout !== null) {
      const rowColumn = tailwindAutoLayoutProps(node, node.inferredAutoLayout);
      return tailwindContainer(node, childrenStr, rowColumn, isJsx);
    }

    // node.layoutMode === "NONE" && node.children.length > 1
    // children needs to be absolute
    return tailwindContainer(node, childrenStr, "", isJsx);
  }
};

// 名称为 propSomething 的属性始终处理 ","
// 有时属性可能不存在，所以不添加 ","
export const tailwindContainer = (
  node: SceneNode &
    SceneNodeMixin &
    BlendMixin &
    LayoutMixin &
    GeometryMixin &
    MinimalBlendMixin,
  children: string,
  additionalAttr: string,
  isJsx: boolean
): string => {
  // ignore the view when size is zero or less
  // while technically it shouldn't get less than 0, due to rounding errors,
  // it can get to values like: -0.000004196293048153166
  
  if (node.width < 0 || node.height < 0) {
    return children;
  }

  let builder = new TailwindDefaultBuilder(node, localTailwindSettings.layerName, isJsx)
    .commonPositionStyles(node, localTailwindSettings.optimizeLayout)
    .commonShapeStyles(node);

  if (builder.attributes || additionalAttr) {
    const build = builder.build(additionalAttr);

    // 如果node是img，则不添加bg-[url()]属性
    let tag = "div";
    let src = "";
    // 如果node的fills是image，则将tag设置为img，并设置src
    if (retrieveTopFill(node.fills)?.type === "IMAGE") {
      if (!("children" in node) || node.children.length === 0) {
        tag = "img";
        src = ` src="https://via.placeholder.com/${node.width.toFixed(
          0
        )}x${node.height.toFixed(0)}"`;
      } else {
        builder.addAttributes(
          `bg-[url(https://via.placeholder.com/${node.width.toFixed(
            0
          )}x${node.height.toFixed(0)})]`
        );
      }
    }

    if (children) {
      return `\n<${tag}${build}${src}>${indentString(children)}\n</${tag}>`;
    } else if (selfClosingTags.includes(tag) || isJsx) {
      return `\n<${tag} id="${node.id}"${build}${src} />`;
    } else {
      return `\n<${tag}${build}${src}></${tag}>`;
    }
  }

  return children;
};

export const tailwindLine = (node: LineNode, isJsx: boolean): string => {
  const builder = new TailwindDefaultBuilder(
    node,
    localTailwindSettings.layerName,
    isJsx
  )
    .commonPositionStyles(node, localTailwindSettings.optimizeLayout)
    .commonShapeStyles(node);

  return `\n<div${builder.build()}></div>`;
};

export const tailwindSection = (node: SectionNode, isJsx: boolean): string => {
  const childrenStr = tailwindWidgetGenerator(node.children, isJsx);
  const builder = new TailwindDefaultBuilder(
    node,
    localTailwindSettings.layerName,
    isJsx
  )
    .size(node, localTailwindSettings.optimizeLayout)
    .position(node, localTailwindSettings.optimizeLayout)
    .customColor(node.fills, "bg");

  if (childrenStr) {
    return `\n<div${builder.build()}>${indentString(childrenStr)}\n</div>`;
  } else {
    return `\n<div${builder.build()}></div>`;
  }
};

export const tailwindCodeGenTextStyles = () => {
  const result = previousExecutionCache
    .map((style) => `// ${style.text}\n${style.style.split(" ").join("\n")}`)
    .join("\n---\n");

  if (!result) {
    return "// 此选择中没有文本式";
  }

  return result;
};
