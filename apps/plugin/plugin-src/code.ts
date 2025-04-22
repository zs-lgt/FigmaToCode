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
import { TextAnnotation } from './annotations/text';
import { UXInfoAnnotationManager } from './annotations/uxInfoAnnotation';
import { log } from "console";

let userPluginSettings: PluginSettings;
let isCodeGenerationEnabled = true;  // 添加代码生成状态控制

const defaultPluginSettings: PluginSettings = {
  framework: "HTML",
  jsx: false,
  optimizeLayout: true,
  showLayerNames: false,
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

  // 发送当前选中节点信息
  const sendSelectedNodeInfo = () => {
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
      // 只取第一个选中的节点
      const selectedNode = selection[0];
      figma.ui.postMessage({
        type: "selected-node-info",
        name: selectedNode.name,
        id: selectedNode.id
      });
    } else {
      figma.ui.postMessage({
        type: "selected-node-info",
        name: "",
        id: ""
      });
    }
  };

  // 初始发送选中节点信息
  sendSelectedNodeInfo();

  figma.on("selectionchange", () => {
    if (isCodeGenerationEnabled) {
      safeRun(userPluginSettings);
    }
    // 当选择变化时，发送选中节点信息
    sendSelectedNodeInfo();
  });

  figma.ui.on('message', async (msg) => {
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
    } else if (msg.type === "import-ux-info") {
      try {
        const textAnnotation = new TextAnnotation();
        const uxManager = new UXInfoAnnotationManager(textAnnotation);
        await uxManager.processUXInfo(msg.data);
        sendResultMessage(true, 'ux-import', '导入UX交互信息成功');
      } catch (error: any) {
        sendResultMessage(false, 'ux-import', `导入失败: ${error.message}`);
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

      // 创建一个变量来收集有comment的节点及其ID
      const nodesWithComments = new Map<string, { node: SceneNode, comment: string[] }>();
      
      // 创建一个收集器函数，导入过程中将收集有comment的节点
      const commentCollector = (nodeId: string, node: SceneNode, data: any) => {
        if (data.comment) {
          nodesWithComments.set(node.id, { node, comment: data.comment });
        }
      };
      importFigmaJSON(data, commentCollector).then(async () => {
        // 如果有带comments的节点，则创建UX标注
        if (nodesWithComments.size > 0) {
            try {
              // 准备UX信息数据
              const uxInfoData: Record<string, string> = {};
              
              // 遍历带comments的节点
              for (const [nodeId, { node, comment }] of nodesWithComments.entries()) {
                // 直接将所有评论合并为一个字符串作为标注内容
                uxInfoData[nodeId] = comment.join('\n\n');
              }
              // 创建并使用UX标注管理器
              const textAnnotation = new TextAnnotation();
              const uxManager = new UXInfoAnnotationManager(textAnnotation);
              await uxManager.processUXInfo(uxInfoData);
              figma.notify(`已为 ${nodesWithComments.size} 个节点创建UX标注`);
            } catch (error: any) {
              console.error('创建UX标注时出错:', error);
              figma.notify(`创建UX标注失败: ${error.message}`, { error: true });
            };
        }
        
        // 发送成功消息
        figma.ui.postMessage({
          type: "success",
          data: `Figma文件导入成功${nodesWithComments.size > 0 ? `，并为 ${nodesWithComments.size} 个节点创建了UX标注` : ''}`,
        });
      }).catch((error) => {
        console.error('Error importing Figma JSON:', error);
        figma.ui.postMessage({
          type: "error",
          data: `导入Figma文件失败: ${error.message}`,
        });
      });
    } else if (msg.type === 'nl2figma-generate') {
      (async () => {  // 使用立即执行的异步函数
        try {
          // 调用API
          const data = await callNL2FigmaAPI(msg.query);
          
          if (data.status === 'success' && data.figma_json) {
            try {
              const parsedJson = JSON.parse(data.figma_json);
              // 导入生成的组件
              const importedNodes = await importFigmaJSON(parsedJson);
              
              // 将query和llmout作为一对数据存储到节点信息中
              if (importedNodes && importedNodes.length > 0 && data.llmout) {
                // 只在最外层节点上存储历史记录
                const topLevelNode = importedNodes[0];
                storeHistoryData(topLevelNode, msg.query, data.llmout);
              }
              
              // 发送成功消息
              sendResultMessage(true, "nl2figma", data.llmout || '组件生成成功');
            } catch (parseError) {
              throw new Error('JSON解析错误');
            }
          } else {
            throw new Error(`API返回状态错误: ${data.status}`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('生成组件失败:', error);
          sendResultMessage(false, "nl2figma", `生成组件失败: ${errorMessage}`);
        }
      })();
    } else if (msg.type === 'img2figma-generate') {
      (async () => {  // 使用立即执行的异步函数
        try {
          if (!msg.img_base64) {
            throw new Error('没有提供图片数据');
          }
          
          // 调用与文生组件相同的API，但使用不同的参数
          const data = await callImg2FigmaAPI(msg.img_base64);
          
          if (data.status === 'success' && data.figma_json) {
            try {
              const parsedJson = JSON.parse(data.figma_json);
              // 导入生成的组件
              const importedNodes = await importFigmaJSON(parsedJson);
              
              // 将响应数据作为一对数据存储到节点信息中
              if (importedNodes && importedNodes.length > 0 && data.llmout) {
                // 只在最外层节点上存储历史记录
                const topLevelNode = importedNodes[0];
                storeHistoryData(topLevelNode, "图片生成组件", data.llmout);
              }
              
              // 发送成功消息
              sendResultMessage(true, "img2figma", data.llmout || '组件生成成功');
            } catch (parseError) {
              throw new Error('JSON解析错误');
            }
          } else {
            throw new Error(`API返回状态错误: ${data.status}`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('图生组件失败:', error);
          sendResultMessage(false, "img2figma", `图生组件失败: ${errorMessage}`);
        }
      })();
    } else if (msg.type === 'check-selection') {
      // 检查是否有选中的节点，并发送选中节点的信息
      sendSelectedNodeInfo();
    } else if (msg.type === 'modify-component') {
      (async () => {
        try {
          // 检查是否有选中的节点
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            throw new Error('请先选择要修改的节点');
          }
          
          // 只取第一个选中的节点
          let selectedNode = selection[0];
          
          // 获取最外层节点（如果选中的是内部节点）
          const topLevelNode = getTopLevelNode(selectedNode);
          if (topLevelNode !== selectedNode) {
            selectedNode = topLevelNode;
          }
          
          // 获取节点的历史上下文
          const historyArray = getHistoryData(selectedNode);
          
          // 构建查询字符串，添加前缀
          const queryWithPrefix = `用户当前选择了【${selectedNode.name}】节点，并提出意见：${msg.query}`;
          
          // 调用API
          const data = await callNL2FigmaAPI(queryWithPrefix, historyArray);
          
          if (data.status === 'success' && data.figma_json) {
            try {
              const parsedJson = JSON.parse(data.figma_json);
              
              // 记录原节点的位置和父节点
              const originalParent = selectedNode.parent;
              const originalIndex = originalParent ? Array.from(originalParent.children).indexOf(selectedNode) : -1;
              const originalX = selectedNode.x;
              const originalY = selectedNode.y;
              
              // 获取原有的历史记录（在删除节点前获取）
              const existingHistoryArray = getHistoryData(selectedNode);
              
              // 删除原节点
              selectedNode.remove();
              
              // 导入新节点
              const importedNodes = await importFigmaJSON(parsedJson);
              
              // 将新节点移动到原节点的位置
              if (importedNodes && importedNodes.length > 0 && originalParent) {
                const newNode = importedNodes[0];
                
                // 如果原节点有索引，将新节点移动到相同位置
                if (originalIndex !== -1) {
                  // 先将节点添加到父节点（如果还没有）
                  if (newNode.parent !== originalParent) {
                    originalParent.appendChild(newNode);
                  }
                  
                  // 移动到原来的索引位置
                  if (originalParent.children.length > originalIndex) {
                    originalParent.insertChild(originalIndex, newNode);
                  }
                }
                
                // 设置位置
                newNode.x = originalX;
                newNode.y = originalY;
                
                // 存储llmout历史
                if (data.llmout) {
                  // 存储历史记录到最外层节点
                  storeHistoryData(newNode, queryWithPrefix, data.llmout, existingHistoryArray);
                }
                
                // 选中新节点
                figma.currentPage.selection = [newNode];
              }
              
              // 发送成功消息
              sendResultMessage(true, "modify-component", data.llmout || '组件修改成功');
            } catch (parseError) {
              throw new Error('JSON解析错误');
            }
          } else {
            throw new Error(`API返回状态错误: ${data.status}`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('修改组件失败:', error);
          sendResultMessage(false, "modify-component", `修改组件失败: ${errorMessage}`);
        }
      })();
    } else if (msg.type === 'export-nodes') {
      const nodes = figma.currentPage.children;
      
      exportNodes(nodes, msg.optimize, false).then(async nodesData => {
        const { nodesInfo, description, images, optimize } = nodesData;
        const imagesData = [];
        for (const imageId of images) {
          const imageBase64 = await getNodeExportImage(imageId.id);
          if (imageBase64) {
            imagesData.push({
              id: imageId.id,
              name: imageId.name,
              base64: imageBase64
            });
          }
        }
        
        // 发送导出结果到UI
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
      exportNodes(nodes, msg.optimize, false).then(async nodesData => {
        const { nodesInfo, description, images, optimize } = nodesData;
        const imagesData = [];
        for (const imageId of images) {
          const imageBase64 = await getNodeExportImage(imageId.id);
          if (imageBase64) {
            imagesData.push({
              id: imageId.id,
              name: imageId.name,
              base64: imageBase64
            });
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
    } else if (msg.type === 'html2figma-generate') {
      (async () => {
        try {
          if (!msg.url) {
            throw new Error('没有提供HTML URL');
          }
          
          // 调用API
          const data = await callHtml2FigmaAPI(msg.url);
          
          if (data.status === 'success' && data.figma_json) {
            try {
              const parsedJson = JSON.parse(data.figma_json);
              // 导入生成的组件
              const importedNodes = await importFigmaJSON(parsedJson);
              
              // 将url和llmout作为一对数据存储到节点信息中
              if (importedNodes && importedNodes.length > 0 && data.llmout) {
                // 只在最外层节点上存储历史记录
                const topLevelNode = importedNodes[0];
                storeHistoryData(topLevelNode, `HTML转换：${msg.url}`, data.llmout);
              }
              
              // 发送成功消息
              sendResultMessage(true, "html2figma", data.llmout || '组件生成成功');
            } catch (parseError) {
              throw new Error('JSON解析错误');
            }
          } else {
            throw new Error(`API返回状态错误: ${data.status}`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('HTML转换失败:', error);
          sendResultMessage(false, "html2figma", `HTML转换失败: ${errorMessage}`);
        }
      })();
    }
    if (msg.type === 'resize') {
      figma.ui.resize(msg.width, msg.height);
    }
  });
};

const codegenMode = async () => {
  // figma.showUI(__html__, { visible: false });
  await getUserSettings();

  figma.codegen.on("generate", (event) => {
    const { language, node } = event;
    const convertedSelection = convertIntoNodes([node], null);
    
    let result: CodegenResult[] = [];

    switch (language) {
      case "html":
        result = [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: false },
              true,
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(userPluginSettings),
            language: "HTML",
          },
        ];
        break;
      case "html_jsx":
        result = [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: true },
              true,
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(userPluginSettings),
            language: "HTML",
          },
        ];
        break;
      case "tailwind":
      case "tailwind_jsx":
        result = [
          {
            title: `Code`,
            code: tailwindMain(convertedSelection, {
              ...userPluginSettings,
              jsx: language === 'tailwind_jsx',
            }),
            language: "HTML",
          },
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
        break;
      case "flutter":
        result = [
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
        break;
      case "swiftUI":
        result = [
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
        break;
      default:
        result = [];
        break;
    }

    return result;
  });
};

// 处理API请求的通用方法
const callNL2FigmaAPI = async (query: string, history: any[] = [], traceId: string = '123') => {
  const API_BASE_URL = 'https://occ.10jqka.com.cn/figma2code/webapi_fuzz/v1/nl2figma';
  const response = await fetch(`${API_BASE_URL}`, {
    method: 'POST',
    headers: {},
    body: JSON.stringify({
      query,
      history,
      traceId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// 图生组件API
const callImg2FigmaAPI = async (img_base64: string, traceId: string = '123') => {
  // 检查并去除base64前缀
  const base64Data = img_base64.includes('base64,') 
    ? img_base64.split('base64,')[1]
    : img_base64;
    
  const API_BASE_URL = 'https://occ.10jqka.com.cn/figma2code/webapi_fuzz/v1/nl2figma';
  const response = await fetch(`${API_BASE_URL}`, {
    method: 'POST',
    headers: {},
    body: JSON.stringify({
      img_base64: base64Data,
      traceId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Html2Figma API
const callHtml2FigmaAPI = async (url: string, traceId: string = '123') => {
  const API_BASE_URL = 'https://occ.10jqka.com.cn/figma2code/webapi_fuzz/v1/html2figma';
  const response = await fetch(`${API_BASE_URL}`, {
    method: 'POST',
    headers: {},
    body: JSON.stringify({
      url,
      traceId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// 获取节点的最外层父节点（组件或实例）
const getTopLevelNode = (node: SceneNode): SceneNode => {
  // 如果节点没有父节点或父节点是页面，则返回节点本身
  if (!node.parent || node.parent.type === 'PAGE') {
    return node;
  }
  
  // 如果父节点是组件或组件实例，则返回父节点
  if (node.parent.type === 'COMPONENT' || node.parent.type === 'INSTANCE') {
    return node.parent as SceneNode;
  }
  
  // 递归查找最外层父节点
  if ('parent' in node.parent) {
    return getTopLevelNode(node.parent as SceneNode);
  }
  
  return node;
};

// 存储历史记录的通用方法 - 修改为总是存储在最外层节点
const storeHistoryData = (node: SceneNode, query: string, llmout: string, existingHistory: any[] = []) => {
  try {
    // 获取最外层节点
    const topLevelNode = getTopLevelNode(node);
    
    // 如果找到了最外层节点，则从该节点获取现有历史记录
    if (topLevelNode !== node) {
      const topLevelHistory = getHistoryData(topLevelNode);
      if (topLevelHistory.length > 0) {
        existingHistory = topLevelHistory;
      }
    }
    
    // 添加当前的query和llmout到历史记录
    const updatedHistory = [...existingHistory, [query, llmout]];
    
    // 将历史记录JSON字符串存储到最外层节点中
    const historyJson = JSON.stringify(updatedHistory);
    topLevelNode.setPluginData('llmOutHistory', historyJson);
    
    return updatedHistory;
  } catch (error) {
    console.error('存储历史记录失败:', error);
    return existingHistory;
  }
};

// 获取历史记录的通用方法 - 修改为从最外层节点获取
const getHistoryData = (node: SceneNode) => {
  // 获取最外层节点
  const topLevelNode = getTopLevelNode(node);
  
  const historyStr = topLevelNode.getPluginData('llmOutHistory') || '';
  
  let historyArray = [];
  if (historyStr) {
    try {
      // 尝试解析已存储的JSON历史记录
      historyArray = JSON.parse(historyStr);
    } catch (error) {
      // 如果解析失败，可能是旧格式，创建一个新的历史记录
      console.warn('解析历史记录失败，创建新的历史记录');
      // 旧格式是直接存储的llmout，将其作为没有query的历史记录
      historyArray = [["", historyStr]];
    }
  }
  
  return historyArray;
};

// 发送成功或错误消息的通用方法
const sendResultMessage = (isSuccess: boolean, source: string, message: string) => {
  figma.ui.postMessage({
    type: isSuccess ? "success" : "error",
    source,
    data: message
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
