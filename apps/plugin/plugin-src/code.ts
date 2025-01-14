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
import { exportNodes, getNodeExportImage } from 'backend/src/export';
import { importFigmaJSON } from 'backend/src/importFigma';

let userPluginSettings: PluginSettings;
let isCodeGenerationEnabled = true;  // 添加代码生成状态控制

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

const standardMode = async () => {
  figma.showUI(__html__, { 
    width: 675, 
    height: 825, 
    themeColors: true,
  });
  await initSettings();

  // 从本地存储获取代码生成状态
  const savedCodeGenState = await figma.clientStorage.getAsync('codeGenerationEnabled');
  if (savedCodeGenState !== undefined) {
    isCodeGenerationEnabled = savedCodeGenState;
  }

  // 初始化时发送状态到UI
  figma.ui.postMessage({
    type: "code-gen-state",
    enabled: isCodeGenerationEnabled
  });

  figma.on("selectionchange", () => {
    if (isCodeGenerationEnabled) {
      safeRun(userPluginSettings);
    }
  });

  figma.ui.on('message', (msg) => {
    if (msg.type === "get-code-gen-state") {
      figma.ui.postMessage({
        type: "code-gen-state",
        enabled: isCodeGenerationEnabled
      });
    } else if (msg.type === "toggle-code-generation") {
      isCodeGenerationEnabled = msg.enabled;
      // 保存状态到本地存储
      figma.clientStorage.setAsync('codeGenerationEnabled', isCodeGenerationEnabled);
      if (!isCodeGenerationEnabled) {
        // 清空当前代码
        figma.ui.postMessage({
          type: "update-code",
          code: "",
        });
      } else {
        // 重新生成代码
        safeRun(userPluginSettings);
      }
    } else if (msg.type === "pluginSettingChanged") {
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
      const data = msg.data;
      if (!data) {
        throw new Error('No data provided');
      }

      importFigmaJSON(data).then(() => {
        // 发送成功消息
        figma.ui.postMessage({
          type: "success",
          data: "Figma文件导入成功",
        });
      }).catch((error) => {
        console.error('Error importing Figma JSON:', error);
        figma.ui.postMessage({
          type: "error",
          data: `导入Figma文件失败: ${error.message}`,
        });
      });
    } else if (msg.type === 'export-nodes') {
      console.log(msg);
      const nodes = figma.currentPage.children;
      exportNodes(nodes, msg.optimize).then(async nodesData => {
        const { nodesInfo, description, images, optimize } = nodesData;
        const imagesData = [];
        for (const imageId of images) {
          const imageBase64 = await getNodeExportImage(imageId.id);
          console.log("imageBase64", imageBase64);
          
          if (imageBase64) {
            if (imageBase64) {
              imagesData.push({
                name: imageId.name,
                data: imageBase64
              });
            }
          }
        }
        // 发送所有数据
        figma.ui.postMessage({
          type: "export-nodes-result",
          data: {
            nodesInfo: JSON.stringify(nodesInfo, null, 2),
            description,
            images: imagesData,
            optimize,
          }
        });
      });
    } else if (msg.type === 'export-selected-nodes') {
      const nodes = figma.currentPage.selection;
      exportNodes(nodes, msg.optimize, false).then(nodesData => {
        const { nodesInfo, description, images, optimize } = nodesData;
        const imagesData = [];
        for (const imageId of images) {
          const imageBase64 = getNodeExportImage(imageId.id);
          if (imageBase64) {
            if (imageBase64) {
              imagesData.push({
                name: imageId.name,
                data: imageBase64
              });
            }
          }
        }
        // 发送所有数据
        figma.ui.postMessage({
          type: "export-nodes-result",
          data: {
            nodesInfo: JSON.stringify(nodesInfo, null, 2),
            description,
            images: imagesData,
            optimize,
          }
        });
      });
    }
    if (msg.type === 'resize') {
      figma.ui.resize(msg.width, msg.height);
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
