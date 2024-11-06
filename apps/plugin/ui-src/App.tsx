import { useEffect, useState } from "react";
import { FrameworkTypes, PluginSettings, PluginUI } from "plugin-ui";
import { log } from "util";

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
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const figmaColorBgValue = rootStyles
    .getPropertyValue("--figma-color-bg")
    .trim();
  let img = ''
  useEffect(() => {
    window.onmessage = async (event: MessageEvent) => {
      const message = event.data.pluginMessage;
      console.log("[ui] message received hha:", message);
      switch (message.type) {
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
            console.log('上传响应:', data);
            const imageUrl = data.data.code_url;
            img = imageUrl;
            console.log('上传成功，图片链接：', imageUrl);
  
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
              const codeText = prevState.code.replace(
                regex,
                (match, group1, group2) => {
                  // 提取 className 和其他属性
                  const classMatch = (group1 + group2).match(/className="([^"]*)"/) || [];
                  const className = classMatch[1] || '';
                  
                  return `<img id="${message.nodeId}" src="${imageUrl}" className="${className}" />`;
                }
              );
              console.log('替换后的代码:', codeText);
              return {
                ...prevState,
                code: codeText
              }
            });
          } catch (error) {
            console.error('上传失败:', error);
          }
          break;
        case "code":
          console.log('message.data:', message.data, img);
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
  console.log("state.code", state.code.slice(0, 25));

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
          console.log('key:', key, 'value:', value);
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
