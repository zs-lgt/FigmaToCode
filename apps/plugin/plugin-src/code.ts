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
import { TextAnnotation } from './ux/annotations/text';
import { Connection } from './ux/connections/connection'
import { TextAnnotationFactory } from './ux/textAnnotationFactory';
import { Edge, ConnectionFactory } from './ux/connectionFactory'

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

interface Ux {
  description: any
  edges: Edge[]
}

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

// 从UX数据中提取评论信息，映射到节点ID
function extractMapsFromUxData(uxData: Ux) {
  const commentsMap = new Map<string, string[]>();
  const { description = [] } = uxData
  console.log('uxData', description);
  // 处理UX数据格式：{ nodeId: { comments: string[] } }
  if (description.length) {
    for (const item of description) {
      const { id, comments } = item;
      commentsMap.set(id, comments);
    };
  }
  return {
    commentsMap,
  };
}

// 修改traverseTree函数
function traverseTree(node: SceneNode, callback: (node: any) => void) {
  callback(node);
  if ('children' in node) {
    (node.children as SceneNode[]).forEach(child => traverseTree(child, callback));
  }
}

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
    } else if (msg.type === "detach-component") {
      // 处理解绑组件的请求
      (async () => {
        try {
          // 检查是否有选中的节点
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            throw new Error('请先选择要解绑的节点');
          }
          
          // 记录原始选中的节点
          const originalSelection = [...selection];
          
          // 处理选中的所有节点
          let totalDetached = 0;
          
          // 第一次解绑
          for (const selectedNode of selection) {
            // 递归解绑选中节点及其所有子节点中的组件实例
            const detached = await detachComponentInstances(selectedNode);
            totalDetached += detached;
          }
          
          // 保持相同的选择状态（因为原始节点可能已变化，所以选择现在的节点）
          // 这里不需要做任何操作，因为解绑后节点应该仍然保持选中状态
          
          // 第二次解绑：对同样的节点再执行一次解绑操作，确保完全解绑
          // 注意：此时选择的节点已经是解绑后的节点，可能结构已改变
          if (figma.currentPage.selection.length > 0) {
            for (const selectedNode of figma.currentPage.selection) {
              const detachedAgain = await detachComponentInstances(selectedNode);
              totalDetached += detachedAgain;
            }
          }
          
          // 发送成功消息
          if (totalDetached > 0) {
            sendResultMessage(true, "detach-component", `成功解绑了 ${totalDetached} 个组件实例`);
          } else {
            sendResultMessage(true, "detach-component", "未找到需要解绑的组件实例");
          }
          
          // 如果代码生成已启用，重新生成代码
          if (isCodeGenerationEnabled) {
            safeRun(userPluginSettings);
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('解绑组件失败:', error);
          sendResultMessage(false, "detach-component", `解绑组件失败: ${errorMessage}`);
        }
      })();
    } else if (msg.type === "import-ux-info") {
      try {
        const textAnnotation = new TextAnnotation();
        const textAnnotationFactory = new TextAnnotationFactory(textAnnotation);
        await textAnnotationFactory.createAnnotation(msg.data);
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
      console.log(123, data);
      importFigmaJSON(data).then(async () => {
        // 发送成功消息
        figma.ui.postMessage({
          type: "success",
          data: `Figma文件导入成功`,
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
      
      exportNodes(nodes, msg.optimize, false, msg.keepOriginal).then(async nodesData => {
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
          
          // 检查输入内容是否包含多个URL
          const inputText = msg.url.trim();
          
          // 处理多URL情况：输入以http开头且包含换行符
          if (inputText.startsWith('http') && inputText.includes('\n')) {
            // 提取所有URL
            const urls: string[] = inputText.split('\n')
              .map((url: string) => url.trim())
              .filter((url: string) => url.startsWith('http'));
            
            if (urls.length === 0) {
              throw new Error('没有检测到有效的URL');
            }
            
            // 记录总共导入的节点
            let allImportedNodes: SceneNode[] = [];
            let successCount = 0;
            let failureCount = 0;
            
            // 发送初始进度信息
            sendProgressInfo(0, urls.length, successCount, failureCount, '准备处理URL...');
            
            // 依次处理每个URL
            for (let i = 0; i < urls.length; i++) {
              const url = urls[i];
              
              // 发送当前进度信息
              sendProgressInfo(i, urls.length, successCount, failureCount, `处理第${i+1}/${urls.length}个URL`);
              
              try {
                // 调用API处理单个URL
                const data = await callHtml2FigmaAPI(url);
                
                if (data.status === 'success' && data.figma_json) {
                  // 解析JSON
                  let importedNodes: SceneNode[] = [];
                  
                  if (typeof data.figma_json === 'string') {
                    const parsedJson = JSON.parse(data.figma_json);
                    importedNodes = await importFigmaJSON(parsedJson);
                  } else if (Array.isArray(data.figma_json)) {
                    // 即使API返回数组，也依次导入每个元素
                    for (const jsonItem of data.figma_json) {
                      const parsedJson = typeof jsonItem === 'string' ? JSON.parse(jsonItem) : jsonItem;
                      const nodes = await importFigmaJSON(parsedJson);
                      importedNodes = [...importedNodes, ...nodes];
                    }
                  } else {
                    // 直接导入
                    importedNodes = await importFigmaJSON(data.figma_json);
                  }
                  
                  // 记录导入的节点
                  allImportedNodes = [...allImportedNodes, ...importedNodes];
                  
                  // 存储历史记录
                  if (importedNodes.length > 0 && data.llmout) {
                    const topLevelNode = importedNodes[0];
                    storeHistoryData(topLevelNode, `HTML转换：${url}`, data.llmout);
                  }
                  
                  successCount++;
                } else {
                  failureCount++;
                  console.error(`URL导入失败: ${url}, 状态: ${data.status || '未知错误'}`);
                }
              } catch (urlError) {
                console.error(`处理URL失败: ${url}`, urlError);
                failureCount++;
                // 继续处理下一个URL
              }
              
              // 更新进度信息
              sendProgressInfo(i+1, urls.length, successCount, failureCount, `已完成${i+1}/${urls.length}个URL`);
            }
            
            // 所有URL处理完毕
            if (allImportedNodes.length > 0) {
              sendProgressInfo(urls.length, urls.length, successCount, failureCount, '导入完成!');
              sendResultMessage(true, "html2figma", `成功导入${allImportedNodes.length}个组件，共处理了${urls.length}个URL`);
            } else {
              sendResultMessage(false, "html2figma", `已处理${urls.length}个URL，但未能成功导入任何组件`);
            }
          } 
          // 处理单URL情况
          else {
            // 保持原有的单URL处理逻辑
            const url = inputText;
            
            // 发送进度信息
            sendProgressInfo(0, 1, 0, 0, '准备处理URL...');
            
            // 调用API
            const data = await callHtml2FigmaAPI(url);
            
            // 更新进度信息
            sendProgressInfo(0, 1, 0, 0, '正在导入组件...');
            
            if (data.status === 'success' && data.figma_json) {
              try {
                // 判断figma_json的类型
                let importedNodes: SceneNode[] = [];
                
                if (typeof data.figma_json === 'string') {
                  // 如果是字符串，解析后直接导入
                  const parsedJson = JSON.parse(data.figma_json);
                  importedNodes = await importFigmaJSON(parsedJson);
                } else {
                  // 非字符串也非数组，尝试直接导入
                  importedNodes = await importFigmaJSON(data.figma_json);
                }
                
                // 完成进度信息
                sendProgressInfo(1, 1, 1, 0, '导入完成!');
                
                // 将url和llmout作为一对数据存储到节点信息中
                if (importedNodes && importedNodes.length > 0 && data.llmout) {
                  // 只在最外层节点上存储历史记录
                  const topLevelNode = importedNodes[0];
                  storeHistoryData(topLevelNode, `HTML转换：${url}`, data.llmout);
                }
                
                // 发送成功消息
                sendResultMessage(true, "html2figma", data.llmout || '组件生成成功');
              } catch (parseError) {
                console.error('JSON解析或导入错误:', parseError);
                // 完成进度信息（失败）
                sendProgressInfo(1, 1, 0, 1, 'JSON解析错误');
                throw new Error('JSON解析或导入错误: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
              }
            } else {
              // 完成进度信息（失败）
              sendProgressInfo(1, 1, 0, 1, 'API返回错误');
              throw new Error(`API返回状态错误: ${data.status}`);
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('HTML转换失败:', error);
          sendResultMessage(false, "html2figma", `HTML转换失败: ${errorMessage}`);
        }
      })();
    } else if (msg.type === 'resize') {
      figma.ui.resize(msg.width, msg.height);
    } else if (msg.type === 'import-ui-ux-json') {
      try {
        const { uiJson, uxJson } = msg.data;
        
        if (!uiJson) {
          throw new Error('UI JSON数据不能为空');
        }
        const uiData = JSON.parse(uiJson);
        const uxData = JSON.parse(uxJson) as Ux;

        // 解析UX数据
        let uxCommentsMap: Map<string, string[]> | null = new Map();
        if (uxJson) {
          try {
            const { commentsMap } = extractMapsFromUxData(uxData);
            uxCommentsMap = commentsMap
            console.log('uxCommentsMap', uxCommentsMap);
          } catch (error) {
            console.error('解析UX数据失败:', error);
            figma.notify('UX数据格式无效，仅导入UI部分', { error: true });
          }
        }

        // 如果uxCommentsMap有数据，则遍历uiData，将comments添加到node的comment属性中
        if (uxCommentsMap.size) {
          console.log(1111)
          traverseTree(uiData[0], (node) => {
            const comments = uxCommentsMap.get(node.id);
            if (comments) {
              console.log('comments', comments);
              node.comment = comments;
            }
          });
        }
        // 创建一个变量来收集有comment的节点及其ID
        const nodesWithComments = new Map<string, { node: SceneNode, comment: string[] }>();
        // 建立一个json id到figma id的映射map
        const nodeIdMap = new Map<string, string>()
        
        // 使用闭包创建一个收集器函数
        const collector = (originalNodeId: string, node: SceneNode, data: any) => {
          if (data.comment) {
            console.log('data.comment', data.comment);
            nodesWithComments.set(node.id, { node, comment: data.comment });
          }
          nodeIdMap.set(originalNodeId, node.id)
        };
        
        
        // 导入UI JSON
        importFigmaJSON(uiData, collector).then(async (importedNodes) => {
          // 如果有带comments的节点，则创建UX标注
          if (nodesWithComments.size > 0) {
            try {
              // 准备UX信息数据
              const uxInfoData: Record<string, string[]> = {};
              console.log('nodesWithComments', nodesWithComments);
              // 遍历带comments的节点
              for (const [nodeId, { node, comment }] of nodesWithComments.entries()) {
                // 直接将所有评论合并为一个字符串作为标注内容
                uxInfoData[nodeId] = comment;
              }
              console.log('uxInfoData', uxInfoData);
              // 批量创建文字标注节点
              const textAnnotation = new TextAnnotation();
              const textFactory = new TextAnnotationFactory(textAnnotation);
              textFactory.createAnnotationV2(uxInfoData);

            } catch (error: any) {
              console.error('创建UX标注时出错:', error);
              figma.notify(`创建UX标注失败: ${error.message}`, { error: true });
            };
          }

          // 批量创建连线
          const { edges = [] } = uxData
          if (edges.length > 0) {
            const connection = new Connection();
            const connectionFactory = new ConnectionFactory(connection);
            // 映射到真实创建的figma节点上
            const realEdges = edges.map(edge => ({
              ...edge,
              start: nodeIdMap.get(edge.start),
              end: nodeIdMap.get(edge.end),
            })) as Edge[]
            console.log('real', realEdges, edges)
            connectionFactory.createConnections(realEdges)
          }

          // 发送成功消息
          figma.ui.postMessage({
            type: "success",
            data: `导入成功：UI组件 ${importedNodes.length} 个${nodesWithComments.size > 0 ? `，UI内置UX标注 ${nodesWithComments.size} 个` : ''}`,
          });
          
          // 导入完成后重新生成代码
          // if (isCodeGenerationEnabled) {
          //   safeRun(userPluginSettings);
          // }
        }).catch((error) => {
          console.error('导入UI+UX失败:', error);
          figma.ui.postMessage({
            type: "error",
            data: `导入UI+UX失败: ${error.message}`,
          });
        });
      } catch (error: any) {
        console.error('解析UI+UX数据失败:', error);
        figma.ui.postMessage({
          type: "error",
          data: `解析UI+UX数据失败: ${error.message}`,
        });
      }
    } else if (msg.type === 'property-stat') {
      (async () => {
        try {
          // 检查是否有选中的节点
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            throw new Error('请先选择要分析的节点');
          }
          
          // 只取第一个选中的节点
          const selectedNode = selection[0];
          
          // 将选中节点导出为JSON
          const exportResult = await exportNodes([selectedNode], false, false);
          const { nodesInfo } = exportResult;
          
          if (!nodesInfo || nodesInfo.length === 0) {
            throw new Error('导出节点信息失败');
          }
          
          // 发送进度信息
          sendProgressInfo(0, 1, 0, 0, '正在分析节点属性和设计变量...');
          
          // 调用API - 注意：API函数内部会提取设计Token
          const data = await callPropertyStatAPI(nodesInfo, msg.query);
          
          if (data.status === 'success' && data.figma_json_list) {
            try {
              // 记录原节点的位置、父节点和在父节点中的索引位置
              const originalParent = selectedNode.parent;
              const originalBounds = {
                x: selectedNode.x,
                y: selectedNode.y
              };
              
              // 记录原节点在父节点中的索引位置
              let originalIndex = -1;
              if (originalParent && 'children' in originalParent) {
                originalIndex = Array.from(originalParent.children).indexOf(selectedNode);
                console.log(`原节点在父节点中的索引位置: ${originalIndex}`);
              }
              
              // 获取原有的历史记录
              const existingHistoryArray = getHistoryData(selectedNode);
              
              // 清除选中节点
              figma.currentPage.selection = [];
              
              // 检查是否需要删除原节点
              const shouldDeleteOrigin = data.delete_origin === true;
              console.log(`是否删除原节点: ${shouldDeleteOrigin}`);
              
              // 只有在delete_origin为true时才删除原节点，否则保留
              if (shouldDeleteOrigin) {
                console.log('根据API返回的delete_origin字段，删除原节点');
                selectedNode.remove();
              } else {
                console.log('保留原节点');
              }
              
              // 更新进度信息
              sendProgressInfo(0, data.figma_json_list.length, 0, 0, '开始导入新组件...');
              
              // 依次导入每个figma_json
              const importedNodes: SceneNode[] = [];
              let successCount = 0;
              let failureCount = 0;
              
              for (let i = 0; i < data.figma_json_list.length; i++) {
                try {
                  // 更新进度
                  sendProgressInfo(i, data.figma_json_list.length, successCount, failureCount, `正在导入第${i+1}/${data.figma_json_list.length}个组件...`);
                  
                  // 解析JSON
                  const jsonData = typeof data.figma_json_list[i] === 'string' 
                    ? JSON.parse(data.figma_json_list[i]) 
                    : data.figma_json_list[i];
                  
                  // 导入节点
                  const nodes = await importFigmaJSON(jsonData);
                  
                  if (nodes && nodes.length > 0) {
                    // 将新节点添加到原节点的父节点，并保持原来的顺序
                    if (originalParent && 'appendChild' in originalParent) {
                      // 处理所有新节点
                      nodes.forEach((node, nodeIndex) => {
                        // 如果节点已有父节点，先从原父节点中移除
                        if (node.parent && node.parent !== originalParent) {
                          node.parent.appendChild(node);
                        }
                        
                        // 设置节点位置
                        if (!shouldDeleteOrigin && i === 0) {
                          // 如果保留原节点，第一个新节点放在原节点旁边
                          node.x = originalBounds.x + selectedNode.width + 20;
                          node.y = originalBounds.y;
                        } else {
                          // 如果删除原节点或非第一个新节点，使用原来的位置规则
                          node.x = originalBounds.x;
                          // 纵向排列，每个新节点比前一个低一些
                          node.y = originalBounds.y + i * (node.height + 20);
                        }
                        
                        // 将节点添加到父节点
                        originalParent.appendChild(node);
                        
                        // 如果有原始索引位置信息，将第一个节点放在原节点的位置
                        if (originalIndex !== -1 && i === 0 && nodeIndex === 0) {
                          // 如果原节点被删除，直接使用原始索引
                          // 如果原节点保留，则插入到原节点后面的位置
                          const insertIndex = shouldDeleteOrigin ? originalIndex : originalIndex + 1;
                          
                          // 尝试在指定位置插入节点
                          try {
                            originalParent.insertChild(insertIndex, node);
                            console.log(`将新节点插入到索引位置: ${insertIndex}`);
                          } catch (error) {
                            console.warn(`插入节点到指定位置失败:`, error);
                          }
                        }
                      });
                    }
                    
                    // 收集导入的节点
                    importedNodes.push(...nodes);
                    successCount++;
                  }
                } catch (error) {
                  console.error(`导入第${i+1}个组件失败:`, error);
                  failureCount++;
                }
              }
              
              // 完成进度信息
              sendProgressInfo(
                data.figma_json_list.length, 
                data.figma_json_list.length, 
                successCount, 
                failureCount, 
                '所有组件导入完成!'
              );
              
              // 选中所有导入的节点
              if (importedNodes.length > 0) {
                // 如果保留了原节点，则同时选中原节点和新节点
                if (!shouldDeleteOrigin) {
                  figma.currentPage.selection = [selectedNode, ...importedNodes];
                } else {
                  figma.currentPage.selection = importedNodes;
                }
                figma.viewport.scrollAndZoomIntoView(importedNodes);
                
                // 将最后一个节点的llmout作为消息
                const message = data.llmout || `成功导入了${importedNodes.length}个组件`;
                sendResultMessage(true, "property-stat", message);
              } else {
                // 如果没有成功导入节点但保留了原节点，仍然选中原节点
                if (!shouldDeleteOrigin) {
                  figma.currentPage.selection = [selectedNode];
                  sendResultMessage(true, "property-stat", data.llmout || "没有可导入的新组件，保留了原始节点");
                } else {
                  throw new Error('没有成功导入任何组件');
                }
              }
            } catch (error: any) {
              console.error('处理返回的JSON失败:', error);
              throw new Error(`处理返回的JSON失败: ${error.message}`);
            }
          } else {
            throw new Error(`API返回状态错误: ${data.status || '未知错误'}`);
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.error('属性统计分析失败:', error);
          sendResultMessage(false, "property-stat", `属性统计分析失败: ${errorMessage}`);
          
          // 更新进度信息为失败状态
          sendProgressInfo(0, 1, 0, 1, `处理失败: ${errorMessage}`);
        }
      })();
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
            ) as unknown as string,
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
            ) as unknown as string,
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
            }) as unknown as string,
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

// 在文件底部添加发送进度信息的函数
const sendProgressInfo = (current: number, total: number, success: number, failure: number, message: string = '') => {
  figma.ui.postMessage({
    type: "html2figma-progress",
    data: {
      current,
      total,
      success,
      failure,
      message
    }
  });
};

// 添加一个提取节点中变量Token的辅助函数
const extractDesignTokens = async (nodeData: any): Promise<any[]> => {
  console.log('开始提取设计变量Token...');
  const tokens: any[] = [];
  const processedIds = new Set<string>(); // 避免重复处理同一个变量ID
  const variableCache = new Map<string, any>(); // 缓存已获取的变量数据
  const componentCache = new Map<string, any>(); // 缓存已获取的组件数据
  let instanceCount = 0; // 统计处理的实例节点数
  let variableCount = 0; // 统计提取的变量数
  
  // 处理单个boundVariables对象
  const processBoundVariables = (boundVars: any, parentKey: string = '') => {
    // 遍历boundVariables的所有属性
    for (const propKey in boundVars) {
      const varRef = boundVars[propKey];
      
      // 处理数组类型的变量引用
      if (Array.isArray(varRef)) {
        varRef.forEach(item => {
          if (item && item.type === 'VARIABLE_ALIAS' && item.id) {
            addToken(item.id, parentKey + '.' + propKey);
          }
        });
      } 
      // 处理单个变量引用
      else if (varRef && varRef.type === 'VARIABLE_ALIAS' && varRef.id) {
        addToken(varRef.id, parentKey + '.' + propKey);
      }
    }
  };
  
  // 获取变量数据并缓存
  const getVariableData = (id: string): any => {
    // 如果缓存中已有此变量，直接返回
    if (variableCache.has(id)) {
      return variableCache.get(id);
    }
    
    try {
      const variable = figma.variables.getVariableById(id);
      if (variable) {
        console.log('获取变量数据:', variable.name, id);
        
        // 创建变量数据对象
        const variableData: any = {
          id: id,
          name: variable.name,
          type: variable.resolvedType,
          key: variable.key,
          remote: variable.remote,
          valuesByMode: { ...variable.valuesByMode } // 克隆一份valuesByMode
        };
        
        // 缓存变量数据
        variableCache.set(id, variableData);
        return variableData;
      }
    } catch (error) {
      console.warn(`无法获取变量信息，ID: ${id}`, error);
    }
    return null;
  };
  
  // 处理变量的valuesByMode属性中的嵌套变量引用
  const resolveNestedVariables = (variableData: any) => {
    if (!variableData || !variableData.valuesByMode) return;
    
    // 遍历所有模式
    for (const modeId in variableData.valuesByMode) {
      const modeValue = variableData.valuesByMode[modeId];
      
      // 如果模式值是变量引用
      if (modeValue && typeof modeValue === 'object' &&
          'type' in modeValue && modeValue.type === 'VARIABLE_ALIAS' &&
          'id' in modeValue && modeValue.id) {
        
        // 获取引用的变量数据
        const nestedVarData = getVariableData(modeValue.id);
        
        // 如果获取成功，将引用的变量数据合并到当前模式值中
        if (nestedVarData) {
          // 保留原始引用信息
          const originalRef = { ...modeValue };
          
          // 在模式值中添加引用变量的完整信息
          modeValue.name = nestedVarData.name;
          modeValue.type = nestedVarData.type;
          modeValue.key = nestedVarData.key;
          modeValue.remote = nestedVarData.remote;
          modeValue.valuesByMode = nestedVarData.valuesByMode;
          
          // 如果需要，也可以添加引用变量的值
          if (nestedVarData.valuesByMode && nestedVarData.valuesByMode[modeId]) {
            modeValue.resolvedValue = nestedVarData.valuesByMode[modeId];
          }
        }
      }
    }
  };
  
  // 添加Token到结果中
  const addToken = (id: string, propertyPath: string) => {
    // 避免重复处理同一个变量ID
    if (!processedIds.has(id)) {
      processedIds.add(id);
      
      // 获取变量信息
      const variableData = getVariableData(id);
      if (variableData) {
        // 添加路径信息
        variableData.path = propertyPath.startsWith('.') ? propertyPath.substring(1) : propertyPath;
        
        // 解析嵌套变量
        resolveNestedVariables(variableData);
        
        // 添加处理后的变量数据到结果中
        tokens.push(variableData);
        variableCount++;
      }
    }
  };
  
  // 辅助函数：尝试以多种方式获取实例节点的组件Key
  const getComponentKey = (node: any): string | null => {
    if (!node || node.type !== 'INSTANCE') return null;
    
    // 直接从node.componentKey获取
    if (node.componentKey) return node.componentKey;
    
    // 如果没有componentKey但有componentId
    if (node.componentId) {
      try {
        // 尝试通过componentId查找主组件
        const instanceNode = figma.getNodeById(node.id) as InstanceNode;
        if (instanceNode && instanceNode.mainComponent) {
          return instanceNode.mainComponent.key;
        }
      } catch (error) {
        console.warn(`通过componentId获取组件Key失败:`, error);
      }
    }
    
    return null;
  };
  
  // 获取组件的完整信息
  const getComponentData = async (componentKey: string): Promise<any> => {
    // 如果缓存中已有此组件，直接返回
    if (componentCache.has(componentKey)) {
      return componentCache.get(componentKey);
    }
    
    try {
      // 查找具有给定componentKey的组件
      const component = figma.getNodeById(componentKey) as ComponentNode || 
                        figma.root.findOne(node => 
                          node.type === 'COMPONENT' && 
                          (node as ComponentNode).key === componentKey
                        ) as ComponentNode;
      
      if (component) {
        console.log('找到组件:', component.name, componentKey);
        
        // 使用getNodeInfo获取完整的组件信息
        const getNodeInfo = (node: SceneNode): any => {
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

          // 填充和描边属性
          if ('fills' in node) nodeInfo.fills = node.fills;
          if ('strokes' in node) nodeInfo.strokes = node.strokes;
          if ('strokeWeight' in node) nodeInfo.strokeWeight = node.strokeWeight;
          if ('strokeAlign' in node) nodeInfo.strokeAlign = node.strokeAlign;
          if ('strokeCap' in node) nodeInfo.strokeCap = node.strokeCap;
          if ('strokeJoin' in node) nodeInfo.strokeJoin = node.strokeJoin;
          if ('strokeMiterLimit' in node) nodeInfo.strokeMiterLimit = node.strokeMiterLimit;
          if ('dashPattern' in node) nodeInfo.dashPattern = node.dashPattern;
          if ('fillStyleId' in node) nodeInfo.fillStyleId = node.fillStyleId;
          if ('strokeStyleId' in node) nodeInfo.strokeStyleId = node.strokeStyleId;
          if ('fillGeometry' in node) nodeInfo.fillGeometry = node.fillGeometry;
          if ('strokeGeometry' in node) nodeInfo.strokeGeometry = node.strokeGeometry;
          
          // 重要：检查boundVariables属性
          if ('boundVariables' in node) nodeInfo.boundVariables = node.boundVariables;

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

          // 组件特有属性
          if (node.type === 'COMPONENT') {
            nodeInfo.componentPropertyDefinitions = (node as ComponentNode).componentPropertyDefinitions;
            nodeInfo.componentKey = (node as ComponentNode).key;
          }

          // 递归处理子节点
          if ('children' in node && node.children) {
            nodeInfo.children = [];
            for (const child of node.children) {
              nodeInfo.children.push(getNodeInfo(child));
            }
          }

          return nodeInfo;
        };
        
        // 获取完整的组件数据
        const componentData = getNodeInfo(component);
        console.log('获取到组件数据:', componentData);
        
        // 缓存组件数据
        componentCache.set(componentKey, componentData);
        return componentData;
      }
    } catch (error) {
      console.warn(`无法获取组件信息，Key: ${componentKey}`, error);
    }
    return null;
  };
  
  // 处理实例节点，尝试从其主组件获取设计令牌
  const processInstanceNode = async (node: any): Promise<void> => {
    if (node.type !== 'INSTANCE' || !node.componentKey) return;
    
    try {
      console.log('处理实例节点:', node.name, node.id, '组件Key:', node.componentKey);
      instanceCount++;
      
      // 获取实例对应的主组件数据
      const componentData = await getComponentData(node.componentKey);
      
      if (componentData) {
        console.log('成功获取主组件数据:', componentData.name);
        
        // 获取当前tokens长度，用于后续标记新添加的tokens
        const beforeCount = tokens.length;
        
        // 从主组件中搜索变量引用
        await searchForBoundVariables(componentData, 'mainComponent');
        
        // 计算新增的token数量
        const newTokenCount = tokens.length - beforeCount;
        
        // 修改最近添加的token，添加实例关联信息
        if (newTokenCount > 0) {
          console.log(`从主组件[${componentData.name}]中提取了${newTokenCount}个设计变量`);
          
          // 从后向前查找，处理新添加的tokens
          for (let i = tokens.length - 1; i >= beforeCount; i--) {
            const token = tokens[i];
            // 添加原始实例的ID和名称作为关联
            token.instanceId = node.id;
            token.instanceName = node.name;
            // 修改路径前缀，使其更有意义
            token.path = token.path.replace('mainComponent', `instance(${node.id})`);
          }
        } else {
          console.log(`主组件[${componentData.name}]中未找到设计变量`);
        }
      } else {
        console.warn(`无法获取实例节点的主组件数据, 实例ID: ${node.id}, 组件Key: ${node.componentKey}`);
      }
    } catch (error) {
      console.warn(`处理实例节点失败，ID: ${node.id}`, error);
    }
  };
  
  // 递归搜索对象中的所有boundVariables
  const searchForBoundVariables = async (obj: any, path: string = ''): Promise<void> => {
    if (!obj || typeof obj !== 'object') return;
    
    // 优先处理INSTANCE节点
    if (obj.type === 'INSTANCE') {
      const componentKey = getComponentKey(obj);
      if (componentKey) {
        obj.componentKey = componentKey; // 确保componentKey存在
        await processInstanceNode(obj);
      }
    }
    
    // 直接检查当前对象是否有boundVariables
    if (obj.boundVariables) {
      processBoundVariables(obj.boundVariables, path);
    }
    
    // 特别处理fills和strokes数组
    if (Array.isArray(obj.fills)) {
      for (let i = 0; i < obj.fills.length; i++) {
        const fill = obj.fills[i];
        const fillPath = `${path}.fills[${i}]`;
        await searchForBoundVariables(fill, fillPath);
      }
    }
    
    if (Array.isArray(obj.strokes)) {
      for (let i = 0; i < obj.strokes.length; i++) {
        const stroke = obj.strokes[i];
        const strokePath = `${path}.strokes[${i}]`;
        await searchForBoundVariables(stroke, strokePath);
      }
    }
    
    // 处理effects数组
    if (Array.isArray(obj.effects)) {
      for (let i = 0; i < obj.effects.length; i++) {
        const effect = obj.effects[i];
        const effectPath = `${path}.effects[${i}]`;
        await searchForBoundVariables(effect, effectPath);
      }
    }
    
    // 处理children数组
    if (Array.isArray(obj.children)) {
      for (let i = 0; i < obj.children.length; i++) {
        const child = obj.children[i];
        await searchForBoundVariables(child, `${path}.children[${i}]`);
      }
    }
    
    // 检查其他可能包含boundVariables的属性
    for (const key in obj) {
      // 跳过已处理的数组属性
      if (key === 'fills' || key === 'strokes' || key === 'effects' || 
          key === 'children' || key === 'boundVariables') continue;
      
      const value = obj[key];
      if (value && typeof value === 'object') {
        const newPath = path ? `${path}.${key}` : key;
        await searchForBoundVariables(value, newPath);
      }
    }
  };
  
  // 开始递归搜索
  await searchForBoundVariables(nodeData);
  
  console.log(`设计变量Token提取完成：处理了${instanceCount}个实例节点，找到${variableCount}个变量。`);
  return tokens;
};

// 属性统计API
const callPropertyStatAPI = async (figma_json: any, query: string, traceId: string = '123') => {
  // 显示进度信息
  sendProgressInfo(0, 1, 0, 0, '正在分析节点属性和设计变量...');
  
  console.log('开始提取设计变量Token数据...');
  
  // 提取设计Token信息
  const designTokens = await extractDesignTokens(figma_json);
  
  console.log(`提取了${designTokens.length}个设计变量Token`);
  
  // 更新进度信息
  sendProgressInfo(0.5, 1, 0, 0, `设计变量分析完成，提取了${designTokens.length}个令牌，准备发送API请求...`);
  
  // API请求体
  const requestBody = {
    figma_json: JSON.stringify(figma_json),
    query,
    design_token: designTokens,
    traceId
  };
  
  console.log('发送API请求...');
  
  const API_BASE_URL = 'https://occ.10jqka.com.cn/figma2code/webapi_fuzz/v1/html2figma';
  const response = await fetch(`${API_BASE_URL}`, {
    method: 'POST',
    headers: {},
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // 更新进度信息
  sendProgressInfo(1, 1, 1, 0, 'API请求完成');

  // 明确返回值类型为any以避免Promise<string>和string类型不匹配
  const result: any = await response.json();
  console.log('API响应成功');
  return result;
};

// 递归解绑组件实例的函数
const detachComponentInstances = async (node: SceneNode): Promise<number> => {
  let detachedCount = 0;
  
  // 使用广度优先搜索收集所有实例节点及其层级
  const collectInstances = (rootNode: SceneNode): { id: string, depth: number }[] => {
    const instances: { id: string, depth: number }[] = [];
    const queue: { node: SceneNode, depth: number }[] = [{ node: rootNode, depth: 0 }];
    
    while (queue.length > 0) {
      const { node: currentNode, depth } = queue.shift()!;
      
      // 如果当前节点是实例，添加到结果数组
      if (currentNode.type === 'INSTANCE') {
        instances.push({ id: currentNode.id, depth });
      }
      
      // 添加子节点到队列
      if ('children' in currentNode && currentNode.children) {
        for (const child of currentNode.children) {
          queue.push({ node: child, depth: depth + 1 });
        }
      }
    }
    
    return instances;
  };
  
  try {
    // 收集所有实例节点的ID和深度
    const instances = collectInstances(node);
    
    if (instances.length === 0) {
      return 0; // 没有实例需要解绑
    }
    
    // 按深度从深到浅排序实例，确保先解绑最深层的子实例
    instances.sort((a, b) => b.depth - a.depth);
    
    // 逐个解绑实例，从最深层开始
    for (const instance of instances) {
      try {
        // 每次都重新获取节点，确保它仍然存在且ID有效
        const validNode = figma.getNodeById(instance.id);
        
        // 只有当节点存在且仍然是实例时才解绑
        if (validNode && validNode.type === 'INSTANCE') {
          figma.notify(`解绑组件: ${validNode.name}`);
          (validNode as InstanceNode).detachInstance();
          detachedCount++;
        }
      } catch (error) {
        // 如果特定实例解绑失败，记录错误但继续处理其他实例
        console.warn(`解绑实例时出错: ${instance.id}`, error);
      }
    }
    
    return detachedCount;
  } catch (error) {
    console.error('解绑组件时发生错误:', error);
    return detachedCount; // 即使出错也返回已解绑的数量
  }
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
