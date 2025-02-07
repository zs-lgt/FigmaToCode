import { useEffect, useState } from "react";
import { FrameworkTypes, PluginSettings, PluginUI } from "plugin-ui";
import JSZip from 'jszip';

interface AppState {
  code: string;
  selectedFramework: FrameworkTypes | null;
  isLoading: boolean;
  htmlPreview: {
    size: { width: number; height: number };
    content: string;
  } | null;
  preferences: PluginSettings | null;
  colors: {
    hex: string;
    colorName: string;
    exportValue: string;
    contrastWhite: number;
    contrastBlack: number;
  }[];
  gradients: { cssPreview: string; exportedValue: string }[];
  figmaFileData: any;
}

export default function App() {
  const [state, setState] = useState<AppState>({
    code: "",
    selectedFramework: null,
    isLoading: false,
    htmlPreview: null,
    preferences: null,
    colors: [],
    gradients: [],
    figmaFileData: null,
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const figmaColorBgValue = rootStyles
    .getPropertyValue("--figma-color-bg")
    .trim();
  let img = ''
  useEffect(() => {
    window.onmessage = async (event: MessageEvent) => {
      const message = event.data.pluginMessage;
      console.log("Received message:", message);
      switch (message.type) {
        case "figma-file-data": {
          setState(prevState => ({
            ...prevState,
            figmaFileData: message.data,
          }));
          // 处理获取到的Figma文件数据
          console.log("Figma file data:", message.data);
          break;
        }
        case "upload-image":
          try {
            // 从 base64 字符串中提取实际的 base64 数据
            const base64Data = event.data.pluginMessage.base64Image.split(',')[1];
            // 将 base64 转换为二进制数据
            const binaryData = atob(base64Data);
            const byteArray = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
              byteArray[i] = binaryData.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'image.png', { type: 'image/png' });
            // 创建 FormData
            const formData = new FormData();
            formData.append('file', file);
            // 图片上传
            const response = await fetch('https://appstore.10jqka.com.cn/open_platform/program/v1/upload', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            const imageUrl = data.data.code_url;
            img = imageUrl;
  
            // 将URL发送回主线程
            parent.postMessage({
              pluginMessage: {
                type: 'upload-image-complete',
                imageUrl: imageUrl
              }
            }, '*');
            setState((prevState) => {
              // 匹配自闭合标签和普通标签
              const regex = new RegExp(`<([^>]*)id="${message.nodeId}"([^>]*?)(?:>.*?</[^>]*>|/>)`, 'g');
              let codeText = prevState.code.replace(
                regex,
                (match, group1, group2) => {
                  // 提取 className 和其他属性
                  const classMatch = (group1 + group2).match(/className="([^"]*)"/) || [];
                  const className = classMatch[1] || '';
                  return `<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img id="${message.nodeId}" src="${imageUrl}" className="${className}" />
                  </div>`;
                }
              );
              
              return {
                ...prevState,
                code: codeText
              }
            });
          } catch (error) {
            console.error('上传失败:', error);
          }
          break;
        case "export-nodes-result":
          console.log("Exported nodes:", message.data);
          try {
            const zip = new JSZip();
            
            // 添加节点信息文件
            if (message.data.nodesInfo) {
              zip.file("ui.json", message.data.nodesInfo);
            }

            if (message.data.components) {
              zip.file("components.json", message.data.components);
            }
            
            // 添加描述信息文件
            if (message.data.description) {
              zip.file("ux.json", JSON.stringify({ description: message.data.description }, null, 2));
            }
            
            // 添加图片文件
            if (message.data.images && message.data.images.length > 0) {
              message.data.images.forEach((imageData) => {
                console.log("imageData:", imageData);
                try {
                  // 从 base64 字符串中提取实际的 base64 数据
                  const base64Data = imageData.data.split(',')[1];
                  // 将 base64 转换为二进制数据
                  const binaryData = atob(base64Data);
                  const byteArray = new Uint8Array(binaryData.length);
                  for (let i = 0; i < binaryData.length; i++) {
                    byteArray[i] = binaryData.charCodeAt(i);
                  }
                  // 将图片添加到 zip
                  zip.file(`images/${imageData.name}.png`, byteArray, { binary: true });
                } catch (error) {
                  console.error(`处理图片 ${imageData.name} 时出错:`, error);
                }
              });
            }
            const { optimize } = message.data;
            // 生成压缩包
            zip.generateAsync({ type: "blob" })
              .then(function(content) {
                // 下载压缩包
                const url = window.URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `design-export-${optimize ? 'simplified' : 'complete'}.zip`);
                document.body.appendChild(link);
                link.click();
                
                setTimeout(() => {
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                }, 100);
              });
          } catch (error) {
            console.error('下载文件失败:', error);
          }
          break;
        case "code":
          setState((prevState) => ({
            ...prevState,
            code: message.data,
            htmlPreview: message.htmlPreview,
            colors: message.colors,
            gradients: message.gradients,
            preferences: message.preferences,
            selectedFramework: message.preferences.framework,
          }));
          break;
        case "pluginSettingChanged":
          setState((prevState) => ({
            ...prevState,
            preferences: message.data,
            selectedFramework: message.data.framework,
          }));
          break;
        case "empty":
          setState((prevState) => ({
            ...prevState,
            code: "// No layer is selected.",
            htmlPreview: null,
            colors: [],
            gradients: [],
          }));
          break;
        case "error":
          setState((prevState) => ({
            ...prevState,
            colors: [],
            gradients: [],
            code: `Error :(\n// ${message.data}`,
          }));
          break;
        default:
          break;
      }
    };

    return () => {
      window.onmessage = null;
    };
  }, []);

  const handleDeleteNode = (nodeId: string) => {
    parent.postMessage(
      { pluginMessage: { type: "delete-node", nodeId } },
      "*"
    );
  };

  const handleDuplicateNode = (nodeId: string) => {
    parent.postMessage(
      { pluginMessage: { type: "duplicate-node", nodeId } },
      "*"
    );
  };

  useEffect(() => {
    if (state.selectedFramework === null) {
      const timer = setTimeout(
        () => setState((prevState) => ({ ...prevState, isLoading: true })),
        300
      );
      return () => clearTimeout(timer);
    } else {
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  }, [state.selectedFramework]);

  if (state.selectedFramework === null) {
    return state.isLoading ? (
      <div className="w-full h-96 justify-center text-center items-center dark:text-white text-lg">
        Loading Plugin...
      </div>
    ) : null;
  }

  const handleFrameworkChange = (updatedFramework: FrameworkTypes) => {
    setState((prevState) => ({
      ...prevState,
      // code: "// Loading...",
      selectedFramework: updatedFramework,
    }));

    parent.postMessage(
      {
        pluginMessage: {
          type: "pluginSettingChanged",
          key: "framework",
          value: updatedFramework,
        },
      },
      "*"
    );
  };

  return (
    <div
      className={`${
        figmaColorBgValue === "#ffffff" ? "" : "dark"
      }`}
    >
      <PluginUI
        code={state.code}
        emptySelection={false}
        selectedFramework={state.selectedFramework}
        setSelectedFramework={handleFrameworkChange}
        htmlPreview={state.htmlPreview}
        preferences={state.preferences}
        onPreferenceChange={(key: string, value: boolean | string) => {
          parent.postMessage(
            {
              pluginMessage: {
                type: "pluginSettingChanged",
                key: key,
                value: value,
              },
            },
            "*"
          );
        }}
        colors={state.colors}
        gradients={state.gradients.map((gradient) => ({
          ...gradient,
          exportValue: gradient.exportedValue,
        }))}
      />
    </div>
  );
}
