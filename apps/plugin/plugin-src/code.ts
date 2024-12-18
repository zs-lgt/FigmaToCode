import { tailwindCodeGenTextStyles } from "./../../../packages/backend/src/tailwind/tailwindMain";
import {
  run,
  flutterMain,
  tailwindMain,
  swiftuiMain,
  convertIntoNodes,
  htmlMain,
  PluginSettings,
} from "backend";
import { retrieveGenericSolidUIColors } from "backend/src/common/retrieveUI/retrieveColors";
import { flutterCodeGenTextStyles } from "backend/src/flutter/flutterMain";
import { htmlCodeGenTextStyles } from "backend/src/html/htmlMain";
import { swiftUICodeGenTextStyles } from "backend/src/swiftui/swiftuiMain";

let userPluginSettings: PluginSettings;

const defaultPluginSettings: PluginSettings = {
  framework: "HTML",
  jsx: false,
  optimizeLayout: true,
  layerName: false,
  inlineStyle: true,
  responsiveRoot: false,
  flutterGenerationMode: "snippet",
  swiftUIGenerationMode: "snippet",
  roundTailwindValues: false,
  roundTailwindColors: false,
  customTailwindColors: false,
};

// A helper type guard to ensure the key belongs to the PluginSettings type
function isKeyOfPluginSettings(key: string): key is keyof PluginSettings {
  return key in defaultPluginSettings;
}

const getUserSettings = async () => {
  const possiblePluginSrcSettings =
    (await figma.clientStorage.getAsync("userPluginSettings")) ?? {};

  const updatedPluginSrcSettings = {
    ...defaultPluginSettings,
    ...Object.keys(defaultPluginSettings).reduce((validSettings, key) => {
      if (
        isKeyOfPluginSettings(key) &&
        key in possiblePluginSrcSettings &&
        typeof possiblePluginSrcSettings[key] ===
          typeof defaultPluginSettings[key]
      ) {
        validSettings[key] = possiblePluginSrcSettings[key] as any;
      }
      return validSettings;
    }, {} as Partial<PluginSettings>),
  };

  userPluginSettings = updatedPluginSrcSettings as PluginSettings;
};

const initSettings = async () => {
  await getUserSettings();
  figma.ui.postMessage({
    type: "pluginSettingChanged",
    data: userPluginSettings,
  });

  safeRun(userPluginSettings);
};

const safeRun = (settings: PluginSettings) => {
  try {
    run(settings);
  } catch (e) {
    if (e && typeof e === "object" && "message" in e) {
      figma.ui.postMessage({
        type: "error",
        data: e.message,
      });
    }
  }
};

// 处理文本节点的样式和内容
const handleTextNode = async (node: TextNode, data: any) => {
  try {
    // 设置默认字体信息
    let fontFamily = "Inter";
    let fontStyle = "Regular";

    // 处理样式
    if (data.style) {
      // 获取字体信息
      if (data.style.fontFamily) {
        fontFamily = data.style.fontFamily;
      }
      if (data.style.fontWeight) {
        fontStyle = data.style.fontWeight >= 700 ? "Bold" : "Regular";
      }

      // 加载字体
      try {
        await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
      } catch {
        // 回退到默认字体
        fontFamily = "Inter";
        fontStyle = "Regular";
        await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
      }

      // 应用字体
      node.fontName = { family: fontFamily, style: fontStyle };

      // 应用其他样式
      if (data.style.fontSize) node.fontSize = data.style.fontSize;
      if (data.style.textAlignHorizontal) node.textAlignHorizontal = data.style.textAlignHorizontal;
      if (data.style.textAlignVertical) node.textAlignVertical = data.style.textAlignVertical;
      if (data.style.letterSpacing) node.letterSpacing = { value: data.style.letterSpacing, unit: 'PIXELS' };
      if (data.style.lineHeightPx) node.lineHeight = { value: data.style.lineHeightPx, unit: 'PIXELS' };
      
      // 设置颜色
      if (data.style.color) {
        node.fills = [{
          type: 'SOLID',
          color: {
            r: data.style.color.r,
            g: data.style.color.g,
            b: data.style.color.b
          }
        }];
      }
    } else {
      // 如果没有样式，加载默认字体
      await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
      node.fontName = { family: fontFamily, style: fontStyle };
    }

    // 设置文本内容
    if (data.characters) {
      node.characters = data.characters;
    }
  } catch (error) {
    console.error('Error handling text node:', error);
    // 确保至少设置了基本字体
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    node.fontName = { family: "Inter", style: "Regular" };
  }
};

// Helper function to create Figma nodes from JSON data
const createNodeFromJson = async (data: any, parent: BaseNode & ChildrenMixin): Promise<SceneNode | null> => {
  try {
    let node: SceneNode | null = null;
    
    // Create node based on type
    switch (data.type) {
      case 'DOCUMENT':
      case 'CANVAS':
      case 'FRAME':
        node = figma.createFrame();
        if (data.type === 'CANVAS') {
          node.fills = [];
          node.layoutMode = "NONE";
        }
        break;

      case 'RECTANGLE':
        node = figma.createRectangle();
        break;

      case 'ELLIPSE':
        node = figma.createEllipse();
        break;

      case 'TEXT':
        node = figma.createText();
        await handleTextNode(node, data);
        break;

      case 'GROUP':
        node = figma.group([], parent);
        break;

      case 'COMPONENT':
        node = figma.createComponent();
        break;

      case 'INSTANCE':
        // For now, we'll create a frame instead of an instance
        node = figma.createFrame();
        break;

      case 'VECTOR':
        node = figma.createVector();
        break;

      case 'BOOLEAN_OPERATION':
        node = figma.createBooleanOperation();
        break;

      default:
        console.warn(`Unsupported node type: ${data.type}`);
        return null;
    }

    // Set name
    if (data.name) node.name = data.name;

    // Set position and size from absoluteBoundingBox
    if (data.absoluteBoundingBox) {
      const { x, y, width, height } = data.absoluteBoundingBox;
      
      // Set size first (if available)
      if (width !== undefined && height !== undefined) {
        node.resize(width, height);
      }
      
      // Set position (if available)
      if (x !== undefined) node.x = x;
      if (y !== undefined) node.y = y;
    } 
    // Fallback to absoluteRenderBounds if absoluteBoundingBox is not available
    else if (data.absoluteRenderBounds) {
      const { x, y, width, height } = data.absoluteRenderBounds;
      
      // Set size first (if available)
      if (width !== undefined && height !== undefined) {
        node.resize(width, height);
      }
      
      // Set position (if available)
      if (x !== undefined) node.x = x;
      if (y !== undefined) node.y = y;
    }
    // If neither is available, try direct properties
    else {
      if (data.width !== undefined) node.resize(data.width, node.height);
      if (data.height !== undefined) node.resize(node.width, data.height);
      if (data.x !== undefined) node.x = data.x;
      if (data.y !== undefined) node.y = data.y;
    }

    // Set transform properties
    if (data.rotation !== undefined) node.rotation = data.rotation;
    if (data.opacity !== undefined) node.opacity = data.opacity;
    if (data.visible !== undefined) node.visible = data.visible;
    if (data.locked !== undefined) node.locked = data.locked;

    // Set layout properties
    if ('layoutMode' in node) {
      if (data.layoutMode) node.layoutMode = data.layoutMode;
      if (data.primaryAxisSizingMode) node.primaryAxisSizingMode = data.primaryAxisSizingMode;
      if (data.counterAxisSizingMode) node.counterAxisSizingMode = data.counterAxisSizingMode;
      if (data.primaryAxisAlignItems) node.primaryAxisAlignItems = data.primaryAxisAlignItems;
      if (data.counterAxisAlignItems) node.counterAxisAlignItems = data.counterAxisAlignItems;
      if (data.paddingLeft !== undefined) node.paddingLeft = data.paddingLeft;
      if (data.paddingRight !== undefined) node.paddingRight = data.paddingRight;
      if (data.paddingTop !== undefined) node.paddingTop = data.paddingTop;
      if (data.paddingBottom !== undefined) node.paddingBottom = data.paddingBottom;
      if (data.itemSpacing !== undefined) node.itemSpacing = data.itemSpacing;
    }

    // Set fills
    if (data.fills && data.type !== 'CANVAS') {
      try {
        if (data.fills.some(fill => fill.type === 'IMAGE')) {
          // Handle image fills differently
          node.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
        } else {
          // Process each fill
          node.fills = data.fills.map(fill => {
            if (fill.type === 'SOLID') {
              return {
                type: 'SOLID',
                color: fill.color || { r: 0, g: 0, b: 0 },
                opacity: fill.opacity,
                blendMode: fill.blendMode || 'NORMAL'
              };
            }
            return fill;
          });
        }
      } catch (error) {
        console.warn('Error setting fills:', error);
      }
    }

    // Set strokes
    if (data.strokes) {
      try {
        node.strokes = data.strokes.map(stroke => ({
          type: stroke.type || 'SOLID',
          color: stroke.color || { r: 0, g: 0, b: 0 },
          opacity: stroke.opacity,
          blendMode: stroke.blendMode || 'NORMAL'
        }));
      } catch (error) {
        console.warn('Error setting strokes:', error);
      }
    }

    // Set effects
    if (data.effects) {
      try {
        node.effects = data.effects;
      } catch (error) {
        console.warn('Error setting effects:', error);
      }
    }

    // Set constraints
    if (data.constraints && 'constraints' in node) {
      try {
        node.constraints = data.constraints;
      } catch (error) {
        console.warn('Error setting constraints:', error);
      }
    }

    // Set clipsContent for frames
    if ('clipsContent' in node && data.clipsContent !== undefined) {
      node.clipsContent = data.clipsContent;
    }

    // Add to parent
    if (parent && node) {
      parent.appendChild(node);
    }

    // Process children
    if (data.children && node && node.type !== 'TEXT' && 'appendChild' in node) {
      for (const childData of data.children) {
        await createNodeFromJson(childData, node as BaseNode & ChildrenMixin);
      }
    }

    return node;
  } catch (error) {
    console.error('Error creating node:', error);
    return null;
  }
};

const standardMode = async () => {
  figma.showUI(__html__, { width: 450, height: 550, themeColors: true });
  await initSettings();
  figma.on("selectionchange", () => {
    safeRun(userPluginSettings);
  });
  figma.ui.on('message', (msg) => {
    console.log("[node] figma.ui.onmessage", msg);

    if (msg.type === "pluginSettingChanged") {
      (userPluginSettings as any)[msg.key] = msg.value;
      figma.clientStorage.setAsync("userPluginSettings", userPluginSettings);
      safeRun(userPluginSettings);
    } else if (msg.type === "delete-node") {
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        selection.forEach(node => node.remove());
        safeRun(userPluginSettings);
      }
    } else if (msg.type === "duplicate-node") {
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        selection.forEach(node => {
          const clone = node.clone();
          node.parent?.appendChild(clone);
        });
        safeRun(userPluginSettings);
      }
    } else if (msg.type === "fetch-figma-file") {
      const fileId = figma.fileKey;
      const accessToken = figma.clientStorage.getAsync('figmaAccessToken');
      
      if (!accessToken) {
        figma.ui.postMessage({
          type: "error",
          data: "请先设置Figma访问令牌",
        });
        return;
      }

      fetch(`https://api.figma.com/v1/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      .then(response => response.json())
      .then(data => {
        // 处理文件数据
        const processedData = {
          name: data.name,
          lastModified: data.lastModified,
          version: data.version,
          document: data.document,
        };
        
        // 发送处理后的数据到UI
        figma.ui.postMessage({
          type: "figma-file-data",
          data: processedData,
        });
      })
      .catch(error => {
        figma.ui.postMessage({
          type: "error",
          data: `获取Figma文件数据失败: ${error.message}`,
        });
      });
    } else if (msg.type === "import-figma-json") {
      try {
        const data = msg.data;
        if (!data) {
          throw new Error('No data provided');
        }

        // 检查是否是完整的文档数据
        const isDocument = data.document || (data.type === 'DOCUMENT');
        const documentData = isDocument ? (data.document || data) : data;

        // 创建一个新的Frame作为导入内容的容器
        const containerFrame = figma.createFrame();
        
        // 设置容器名称
        if (isDocument && data.name) {
          containerFrame.name = `Import: ${data.name}`;
        } else {
          containerFrame.name = documentData.name || '导入的设计';
        }

        // 设置容器尺寸
        let containerWidth = 800;
        let containerHeight = 600;

        // 如果是文档数据，尝试从子节点计算合适的尺寸
        if (isDocument && documentData.children) {
          const childrenBounds = documentData.children.reduce((bounds: any, child: any) => {
            const childRight = (child.x || 0) + (child.width || 0);
            const childBottom = (child.y || 0) + (child.height || 0);
            return {
              right: Math.max(bounds.right, childRight),
              bottom: Math.max(bounds.bottom, childBottom)
            };
          }, { right: 0, bottom: 0 });

          containerWidth = Math.max(800, childrenBounds.right + 100);
          containerHeight = Math.max(600, childrenBounds.bottom + 100);
        } else if (documentData.width && documentData.height) {
          containerWidth = documentData.width;
          containerHeight = documentData.height;
        }

        containerFrame.resize(containerWidth, containerHeight);

        // 将容器添加到当前页面
        figma.currentPage.appendChild(containerFrame);

        // 处理节点数据
        if (isDocument && documentData.children) {
          // 如果是文档数据，处理其子节点
          for (const childData of documentData.children) {
            // 如果是 CANVAS 类型，直接处理其子节点
            if (childData.type === 'CANVAS' && childData.children) {
              for (const canvasChild of childData.children) {
                await createNodeFromJson(canvasChild, containerFrame);
              }
            } else {
              await createNodeFromJson(childData, containerFrame);
            }
          }
        } else if (Array.isArray(documentData)) {
          // 如果是节点数组
          for (const nodeData of documentData) {
            await createNodeFromJson(nodeData, containerFrame);
          }
        } else {
          // 如果是单个节点
          await createNodeFromJson(documentData, containerFrame);
        }

        // 选中新创建的容器
        figma.currentPage.selection = [containerFrame];
        figma.viewport.scrollAndZoomIntoView([containerFrame]);

        // 发送成功消息
        figma.ui.postMessage({
          type: "success",
          data: "JSON数据导入成功",
        });
      } catch (error) {
        console.error('Error importing JSON:', error);
        figma.ui.postMessage({
          type: "error",
          data: `导入JSON失败: ${error.message}`,
        });
      }
    }
  });
};

const codegenMode = async () => {
  // figma.showUI(__html__, { visible: false });
  await getUserSettings();

  figma.codegen.on("generate", ({ language, node }) => {
    const convertedSelection = convertIntoNodes([node], null);

    switch (language) {
      case "html":
        return [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: false },
              true
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(false),
            language: "HTML",
          },
        ];
      case "html_jsx":
        return [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: true },
              true
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(true),
            language: "HTML",
          },
        ];
      case "tailwind":
      case "tailwind_jsx":
        return [
          {
            title: `Code`,
            code: tailwindMain(convertedSelection, {
              ...userPluginSettings,
              jsx: language === 'tailwind_jsx',
            }),
            language: "HTML",
          },
          // {
          //   title: `Style`,
          //   code: tailwindMain(convertedSelection, defaultPluginSettings),
          //   language: "HTML",
          // },
          {
            title: `Tailwind Colors`,
            code: retrieveGenericSolidUIColors("Tailwind")
              .map((d) => {
                let str = `${d.hex};`
                if (d.colorName !== d.hex) {
                  str += ` // ${d.colorName}`
                }
                if (d.meta) {
                  str += ` (${d.meta})`
                }
                return str;
              })
              .join("\n"),
            language: "JAVASCRIPT",
          },
          {
            title: `Text Styles`,
            code: tailwindCodeGenTextStyles(),
            language: "HTML",
          },
        ];
      case "flutter":
        return [
          {
            title: `Code`,
            code: flutterMain(convertedSelection, {
              ...userPluginSettings,
              flutterGenerationMode: "snippet",
            }),
            language: "SWIFT",
          },
          {
            title: `Text Styles`,
            code: flutterCodeGenTextStyles(),
            language: "SWIFT",
          },
        ];
      case "swiftUI":
        return [
          {
            title: `SwiftUI`,
            code: swiftuiMain(convertedSelection, {
              ...userPluginSettings,
              swiftUIGenerationMode: "snippet",
            }),
            language: "SWIFT",
          },
          {
            title: `Text Styles`,
            code: swiftUICodeGenTextStyles(),
            language: "SWIFT",
          },
        ];
      default:
        break;
    }

    const blocks: CodegenResult[] = [];
    return blocks;
  });
};

switch (figma.mode) {
  case "default":
  case "inspect":
    standardMode();
    break;
  case "codegen":
    codegenMode();
    break;
  default:
    break;
}
