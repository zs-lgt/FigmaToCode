import { useState, useRef, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark as theme } from "react-syntax-highlighter/dist/esm/styles/prism";
import copy from "copy-to-clipboard"
import classNames from "classnames";;

export type FrameworkTypes = "HTML" | "Tailwind" | "Flutter" | "SwiftUI";

// This must be kept in sync with the backend.
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
  roundTailwindColors: boolean;
  customTailwindColors: boolean;
};

type PluginUIProps = {
  code: string;
  htmlPreview: {
    size: { width: number; height: number };
    content: string;
  } | null;
  emptySelection: boolean;
  selectedFramework: FrameworkTypes;
  setSelectedFramework: (framework: FrameworkTypes) => void;
  preferences: PluginSettings | null;
  onPreferenceChange: (key: string, value: boolean | string) => void;
  colors: {
    hex: string;
    colorName: string;
    exportValue: string;
    contrastWhite: number;
    contrastBlack: number;
  }[];
  gradients: { cssPreview: string; exportValue: string }[];
};

interface MessageModalProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
}

const MessageModal: React.FC<MessageModalProps> = ({ message, isOpen, onClose }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    copy(message);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col m-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-base font-medium text-gray-900 dark:text-white">
            大模型输出
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-3 overflow-auto flex-grow">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono break-words">
              {message}
            </pre>
          </div>
        </div>
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex justify-end space-x-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isCopied
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <svg 
              className="mr-1.5 h-4 w-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d={isCopied 
                  ? "M5 13l4 4L19 7" 
                  : "M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                }
              />
            </svg>
            {isCopied ? '已复制' : '复制内容'}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

export const PluginUI = (props: PluginUIProps) => {
  const [isResponsiveExpanded, setIsResponsiveExpanded] = useState(false);
  const [uiJsonInput, setUiJsonInput] = useState('');
  const [showUiJsonModal, setShowUiJsonModal] = useState(false);
  const [enableCodeGen, setEnableCodeGen] = useState(true);
  const [showNL2FigmaModal, setShowNL2FigmaModal] = useState(false);
  const [nl2figmaInput, setNl2figmaInput] = useState('');
  const [showModifyComponentModal, setShowModifyComponentModal] = useState(false);
  const [modifyComponentInput, setModifyComponentInput] = useState('');
  const [selectedNodeName, setSelectedNodeName] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUxImportModal, setShowUxImportModal] = useState(false);
  const [showImg2FigmaModal, setShowImg2FigmaModal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showHtml2FigmaModal, setShowHtml2FigmaModal] = useState(false);
  const [html2figmaInput, setHtml2figmaInput] = useState('');
  const [showUiUxModal, setShowUiUxModal] = useState(false);
  const [uiJsonFile, setUiJsonFile] = useState<File | null>(null);
  const [uxJsonFile, setUxJsonFile] = useState<File | null>(null);
  const [showPropertyStatModal, setShowPropertyStatModal] = useState(false);
  const [propertyStatInput, setPropertyStatInput] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uiJsonFileRef = useRef<HTMLInputElement>(null);
  const uxJsonFileRef = useRef<HTMLInputElement>(null);
  
  // 添加进度状态
  const [importProgress, setImportProgress] = useState<ProgressState>({
    isActive: false,
    current: 0,
    total: 0,
    success: 0,
    failure: 0,
    message: ''
  });

  // 处理插件消息
  useEffect(() => {
    // 处理插件消息
    const handlePluginMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage;
      if (!message) return;

      // 处理成功消息
      if (message.type === "success") {
        // 关闭加载状态
        setIsLoading(false);
        
        // 处理不同来源的成功消息
        if (message.source === 'nl2figma') {
          setShowNL2FigmaModal(false);
          setNl2figmaInput('');
        } else if (message.source === 'img2figma') {
          setShowImg2FigmaModal(false);
          setImagePreview(null);
        } else if (message.source === 'html2figma') {
          // HTML2Figma成功后不立即关闭模态框，等用户查看进度信息后自己关闭
          // 只更新进度条显示为完成状态
          setImportProgress(prev => ({
            ...prev,
            message: '导入完成！',
            isActive: true
          }));
          
        } else if (message.source === 'modify-component') {
          setShowModifyComponentModal(false);
          setModifyComponentInput('');
        } else if (message.source === 'property-stat') {
          setShowPropertyStatModal(false);
          setPropertyStatInput('');
        }
        
        // 使用Modal显示成功消息（除HTML2Figma外）
        if (message.source === 'nl2figma' || message.source === 'img2figma' || 
            message.source === 'modify-component' || message.source === 'property-stat') {
          setModalMessage(message.data);
          setIsModalOpen(true);
        }
      }
      // 处理错误消息
      else if (message.type === "error") {
        // 关闭加载状态
        setIsLoading(false);
        
        // 使用Modal显示错误消息
        if (message.source === 'nl2figma' || message.source === 'img2figma' || 
            message.source === 'modify-component' || message.source === 'property-stat') {
          setModalMessage(message.data);
          setIsModalOpen(true);
          
          // 如果是修改组件的错误，留在模态框中
          if (message.source === 'modify-component' || message.source === 'property-stat') {
            // 不关闭模态框，让用户可以尝试修改查询
          } else {
            // 其他情况关闭相应的模态框
            if (message.source === 'nl2figma') {
              setShowNL2FigmaModal(false);
              setNl2figmaInput('');
            } else if (message.source === 'img2figma') {
              setShowImg2FigmaModal(false);
              setImagePreview(null);
            }
          }
        } else if (message.source === 'html2figma') {
          // HTML2Figma错误信息通过进度条显示
          setImportProgress(prev => ({
            ...prev,
            message: `导入失败：${message.data}`,
            isActive: true
          }));
        } else {
          // 其他错误直接显示在控制台
          console.error(message.data);
        }
      } else if (message && message.type === 'selected-node-info') {
        // 接收选中节点的信息
        setSelectedNodeName(message.name || '');
      } else if (message.type === "code-gen-state") {
        // 现有代码
      } else if (message.type === "export-nodes-result") {
        // 现有代码
      } else if (message.type === "html2figma-progress") {
        // 处理HTML2Figma进度信息
        setImportProgress({
          isActive: true,
          current: message.data.current,
          total: message.data.total,
          success: message.data.success,
          failure: message.data.failure,
          message: message.data.message || ''
        });
      } else if (message.type === "property-stat-progress") {
        // 处理属性统计进度信息
        setImportProgress({
          isActive: true,
          current: message.data.current,
          total: message.data.total,
          success: message.data.success,
          failure: message.data.failure,
          message: message.data.message || ''
        });
      }
    };
    window.addEventListener('message', handlePluginMessage);
    return () => window.removeEventListener('message', handlePluginMessage);
  }, []);

  useEffect(() => {
    // 从插件获取初始状态
    window.parent.postMessage({ pluginMessage: { type: 'get-code-gen-state' } }, "*");

    // 监听插件消息
    const messageHandler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg && msg.type === 'code-gen-state') {
        setEnableCodeGen(msg.enabled);
      }
    };
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // 更新开关状态时通知插件
  const handleCodeGenToggle = () => {
    const newState = !enableCodeGen;
    setEnableCodeGen(newState);
    window.parent.postMessage(
      { 
        pluginMessage: { 
          type: 'toggle-code-generation',
          enabled: newState 
        } 
      },
      "*"
    );
  };

  useEffect(() => {
    // 通知插件当前代码生成状态
    window.parent.postMessage(
      { 
        pluginMessage: { 
          type: 'toggle-code-generation',
          enabled: enableCodeGen 
        } 
      },
      "*"
    );
  }, [enableCodeGen]);

  const handleDeleteNode = () => {
    const selection = window.parent.postMessage(
      { pluginMessage: { type: "delete-node" } },
      "*"
    );
  };

  const handleDuplicateNode = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "duplicate-node" } },
      "*"
    );
  };

  const handleFetchFigmaFile = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "fetch-figma-file" } },
      "*"
    );
  };

  const handleImportUiJson = () => {
    try {
      const uiJsonData = JSON.parse(uiJsonInput);
      const data = uiJsonData.nodesInfo || uiJsonData;
      
      // 直接发送数据到插件
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: "import-figma-json", 
            data: data
          } 
        },
        "*"
      );
      
      setShowUiJsonModal(false);
      setUiJsonInput('');
    } catch (error) {
      console.error('UI JSON parsing error:', error);
      alert('Invalid UI JSON format');
    }
  };

  const handleExportNodesClick = () => {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'export-nodes',
        optimize: true
      }
    }, '*');
  };

  const handleExportCompleteNodesClick = () => {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'export-nodes',
        optimize: false
      }
    }, '*');
  };

  const handleExportFullNodesClick = () => {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'export-nodes',
        optimize: false,
        keepOriginal: true
      }
    }, '*');
  };

  const handleExportSelectedNodesClick = () => {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'export-selected-nodes',
        optimize: false,
      }
    }, '*');
  };

  const handleNL2FigmaClick = () => {
    setShowNL2FigmaModal(true);
  };

  const handleNL2FigmaSubmit = () => {
    try {
      setIsLoading(true);
      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: "nl2figma-generate",
            query: nl2figmaInput
          } 
        },
        "*"
      );
    } catch (error: any) {
      setIsLoading(false);
      console.error('发送请求失败:', error);
      alert(`发送请求失败: ${error.message}`);
    }
  };

  const handleModifyComponentClick = () => {
    // 检查是否有选中的节点
    window.parent.postMessage(
      { 
        pluginMessage: { 
          type: "check-selection"
        } 
      },
      "*"
    );
    
    // 打开修改组件模态框
    setShowModifyComponentModal(true);
  };

  const closeModifyComponentModal = () => {
    setShowModifyComponentModal(false);
    setModifyComponentInput(''); // 清空输入框
  };

  const handleModifyComponentSubmit = () => {
    try {
      if (!selectedNodeName) {
        setModalMessage('请先选择要修改的节点');
        setIsModalOpen(true);
        return;
      }
      
      setIsLoading(true);
      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: "modify-component",
            query: modifyComponentInput
          } 
        },
        "*"
      );
    } catch (error: any) {
      setIsLoading(false);
      console.error('发送请求失败:', error);
      alert(`发送请求失败: ${error.message}`);
    }
  };

  // 图生组件处理函数
  const handleImg2FigmaClick = () => {
    setShowImg2FigmaModal(true);
    setImagePreview(null);
  };

  // 修改handlePaste函数使其可以处理整个模态框的粘贴事件
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setImagePreview(base64);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // 提交图片生成组件
  const handleImg2FigmaSubmit = () => {
    if (!imagePreview) {
      return;
    }
    
    try {
      setIsLoading(true);
      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: "img2figma-generate",
            img_base64: imagePreview
          } 
        },
        "*"
      );
    } catch (error: any) {
      setIsLoading(false);
      console.error('发送请求失败:', error);
      alert(`发送请求失败: ${error.message}`);
    }
  };

  const handleHtml2FigmaClick = () => {
    setShowHtml2FigmaModal(true);
  };

  // 修改handleHtml2FigmaSubmit函数
  const handleHtml2FigmaSubmit = () => {
    try {
      setIsLoading(true);
      // 重置并激活进度状态
      setImportProgress({
        isActive: true,
        current: 0,
        total: 0,
        success: 0,
        failure: 0,
        message: '准备导入...'
      });
      
      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: "html2figma-generate",
            url: html2figmaInput
          } 
        },
        "*"
      );
    } catch (error: any) {
      setIsLoading(false);
      setImportProgress({
        isActive: false,
        current: 0,
        total: 0,
        success: 0,
        failure: 0,
        message: ''
      });
      console.error('发送请求失败:', error);
      alert(`发送请求失败: ${error.message}`);
    }
  };

  const handleImportUiUxClick = () => {
    setShowUiUxModal(true);
  };
  
  const handleUiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUiJsonFile(file);
      const fileNameElement = document.getElementById('ui-file-name');
      if (fileNameElement) {
        fileNameElement.textContent = `已选择: ${file.name}`;
      }
    }
  };
  
  const handleUxFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUxJsonFile(file);
      const fileNameElement = document.getElementById('ux-file-name');
      if (fileNameElement) {
        fileNameElement.textContent = `已选择: ${file.name}`;
      }
    }
  };
  
  const handleImportUiUxSubmit = () => {
    if (!uiJsonFile) {
      alert('请先选择UI JSON文件');
      return;
    }
    
    // 设置加载状态
    setIsLoading(true);
    
    // 开始读取UI文件
    const uiReader = new FileReader();
    uiReader.onload = (uiEvent) => {
      try {
        const uiJsonContent = uiEvent.target?.result as string;
        
        // 如果有UX文件，也读取
        if (uxJsonFile) {
          const uxReader = new FileReader();
          uxReader.onload = async (uxEvent) => {
            try {
              const uxJsonContent = uxEvent.target?.result as string;
              // const uxJson = JSON.parse(uxJsonContent);
              // const { description } = uxJson
              // let commnetData = []
              // if (description) {
              //   commnetData = await Promise.all(description.map(async (item: any) => {
              //     return new Promise(async (resolve, reject) => {
              //       const comments = await Promise.all(item.comments.map(async (comment: any) => {
              //         if (isSvgBase64(comment)) {
              //           const pngBase64 = await svgBase64ToPngBase64(comment)
              //           return pngBase64
              //         }
              //         return comment
              //       }))
              //       resolve({
              //         ...item,
              //         comments
              //       })
              //     })
              //   }))
              // }
              // console.log(commnetData)

              // 发送两个文件内容到插件
              window.parent.postMessage(
                { 
                  pluginMessage: { 
                    type: 'import-ui-ux-json',
                    data: {
                      uiJson: uiJsonContent,
                      uxJson: uxJsonContent
                    }
                  } 
                },
                "*"
              );
              
              // 关闭模态框并清空状态
              setShowUiUxModal(false);
              setUiJsonFile(null);
              setUxJsonFile(null);
              
            } catch (error) {
              setIsLoading(false);
              console.error(error)
              alert('UX JSON格式无效');
            }
          };
          uxReader.readAsText(uxJsonFile);
        } else {
          // 只发送UI文件内容到插件
          window.parent.postMessage(
            { 
              pluginMessage: { 
                type: 'import-ui-ux-json',
                data: {
                  uiJson: uiJsonContent,
                  uxJson: null
                }
              } 
            },
            "*"
          );
          
          // 关闭模态框并清空状态
          setShowUiUxModal(false);
          setUiJsonFile(null);
        }
      } catch (error) {
        setIsLoading(false);
        alert('UI JSON格式无效');
      }
    };
    uiReader.readAsText(uiJsonFile);
  };

  // 添加属性统计&&修改功能处理函数
  const handlePropertyStatClick = () => {
    // 检查是否有选中的节点
    window.parent.postMessage(
      { 
        pluginMessage: { 
          type: "check-selection"
        } 
      },
      "*"
    );
    
    // 打开属性统计&&修改模态框
    setShowPropertyStatModal(true);
  };

  const closePropertyStatModal = () => {
    setShowPropertyStatModal(false);
    setPropertyStatInput(''); // 清空输入框
  };

  const handlePropertyStatSubmit = () => {
    try {
      if (!selectedNodeName) {
        setModalMessage('请先选择要分析的节点');
        setIsModalOpen(true);
        return;
      }
      
      setIsLoading(true);
      // 重置并激活进度状态
      setImportProgress({
        isActive: true,
        current: 0,
        total: 0,
        success: 0,
        failure: 0,
        message: '准备分析...'
      });
      
      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: "property-stat",
            query: propertyStatInput
          } 
        },
        "*"
      );
    } catch (error: any) {
      setIsLoading(false);
      setImportProgress({
        isActive: false,
        current: 0,
        total: 0,
        success: 0,
        failure: 0,
        message: ''
      });
      console.error('发送请求失败:', error);
      alert(`发送请求失败: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full dark:text-white">
      <div className="p-2 grid grid-cols-4 sm:grid-cols-2 md:grid-cols-4 gap-1">
        {["HTML", "Tailwind"].map((tab) => (
          <button
            key={`tab ${tab}`}
            className={`w-full p-1 text-sm ${
              props.selectedFramework === tab
                ? "bg-green-500 dark:bg-green-600 text-white rounded-md font-semibold shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border focus:border-0 border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-green-600 dark:hover:bg-green-800 dark:hover:border-green-800 hover:text-white dark:hover:text-white font-semibold shadow-sm"
            }`}
            onClick={() => {
              props.setSelectedFramework(tab as FrameworkTypes);
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      
      {/* Node Control Buttons */}
      <div className="flex gap-2 p-2 justify-end">
        <div className="p-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCodeGenToggle}
              className={`px-2 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                enableCodeGen 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100" 
                : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {enableCodeGen ? "关闭代码生成" : "开启代码生成"}
            </button>
            
            <button
              onClick={() => setShowUiJsonModal(true)}
              className="px-3 py-1 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-md shadow-sm"
            >
              导入JSON
            </button>

            <button
              onClick={handleExportSelectedNodesClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              导出选中
            </button>
            <button
              onClick={handleExportNodesClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              导出设计信息（精简版）
            </button>
            <button
              onClick={handleExportCompleteNodesClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              导出设计信息（组件版）
            </button>
            <button
              onClick={handleExportFullNodesClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              导出设计信息（完整版）
            </button>

            <button
              onClick={handleNL2FigmaClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              文生组件
            </button>
            <button
              onClick={handleImg2FigmaClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              图生组件
            </button>
            <button
              onClick={handleModifyComponentClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              修改组件
            </button>
            <button
              onClick={handlePropertyStatClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              属性统计&&修改
            </button>
            <button
              onClick={() => setShowUxImportModal(true)}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              导入UX
            </button>
            <button
              onClick={handleHtml2FigmaClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Html2Figma
            </button>

            <button
              onClick={handleImportUiUxClick}
              className="flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              导入UI&UX
            </button>
          </div>
        </div>
      </div>

      {/* UI+UX Import Modal */}
      {showUiUxModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">导入UI+UX</h3>
              {isLoading && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  导入中...
                </div>
              )}
            </div>
            
            <div className="space-y-6">
              {/* UI JSON 上传区域 */}
              <div className="space-y-2">
                <h4 className="text-base font-medium dark:text-gray-200">UI JSON（必需）</h4>
                <div 
                  className="border-2 border-dashed rounded-md p-4 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-blue-500');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-blue-500');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-blue-500');
                    
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      if (file.type === 'application/json' || file.name.endsWith('.json')) {
                        setUiJsonFile(file);
                        const fileNameElement = document.getElementById('ui-file-name');
                        if (fileNameElement) {
                          fileNameElement.textContent = `已选择: ${file.name}`;
                        }
                      } else {
                        alert('请上传JSON文件');
                      }
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center space-y-2 text-gray-500 dark:text-gray-400">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm">点击上传或拖拽UI JSON文件至此处</p>
                    <input
                      type="file"
                      accept=".json"
                      ref={uiJsonFileRef}
                      onChange={handleUiFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => uiJsonFileRef.current?.click()}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      选择UI JSON文件
                    </button>
                  </div>
                </div>
                <div id="ui-file-name" className="text-sm text-gray-600 dark:text-gray-400">
                  {uiJsonFile && `已选择: ${uiJsonFile.name}`}
                </div>
              </div>
              
              {/* UX JSON 上传区域 */}
              <div className="space-y-2">
                <h4 className="text-base font-medium dark:text-gray-200">UX JSON（可选）</h4>
                <div 
                  className="border-2 border-dashed rounded-md p-4 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-green-500');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-green-500');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-green-500');
                    
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      if (file.type === 'application/json' || file.name.endsWith('.json')) {
                        setUxJsonFile(file);
                        const fileNameElement = document.getElementById('ux-file-name');
                        if (fileNameElement) {
                          fileNameElement.textContent = `已选择: ${file.name}`;
                        }
                      } else {
                        alert('请上传JSON文件');
                      }
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center space-y-2 text-gray-500 dark:text-gray-400">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm">点击上传或拖拽UX JSON文件至此处（可选）</p>
                    <input
                      type="file"
                      accept=".json"
                      ref={uxJsonFileRef}
                      onChange={handleUxFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => uxJsonFileRef.current?.click()}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      选择UX JSON文件
                    </button>
                  </div>
                </div>
                <div id="ux-file-name" className="text-sm text-gray-600 dark:text-gray-400">
                  {uxJsonFile && `已选择: ${uxJsonFile.name}`}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowUiUxModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleImportUiUxSubmit}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading || !uiJsonFile}
              >
                {isLoading ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UI JSON Import Modal */}
      {showUiJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowUiJsonModal(false)}></div>
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">导入 JSON</h3>
              <button
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
                onClick={() => setShowUiJsonModal(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              请粘贴包含UI结构的JSON数据
            </p>
            <textarea
              className="w-full h-64 p-2 border rounded-md dark:bg-neutral-700 dark:border-neutral-600 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={uiJsonInput}
              onChange={(e) => setUiJsonInput(e.target.value)}
              placeholder="粘贴 JSON 数据..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors"
                onClick={() => {
                  setShowUiJsonModal(false);
                  setUiJsonInput('');
                }}
              >
                取消
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                onClick={handleImportUiJson}
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* NL2Figma Modal */}
      {showNL2FigmaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">文生组件</h3>
              {isLoading && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  生成中...
                </div>
              )}
            </div>
            <textarea
              value={nl2figmaInput}
              onChange={(e) => setNl2figmaInput(e.target.value)}
              className="w-full h-32 p-2 border rounded-md mb-4 dark:bg-gray-700 dark:text-white"
              placeholder="请输入组件描述，例如：实现ios顶部状态栏，时间为5:20，仅带蓝牙和电池icon"
              disabled={isLoading}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNL2FigmaModal(false);
                  setNl2figmaInput('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleNL2FigmaSubmit}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 修改组件模态框 */}
      {showModifyComponentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">修改组件</h3>
              {isLoading && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  修改中...
                </div>
              )}
            </div>
            
            {selectedNodeName ? (
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                当前选择了【{selectedNodeName}】节点
              </div>
            ) : (
              <div className="mb-4 text-sm text-red-500 dark:text-red-400">
                请先选择要修改的节点
              </div>
            )}
            
            <textarea
              value={modifyComponentInput}
              onChange={(e) => setModifyComponentInput(e.target.value)}
              className="w-full h-32 p-2 border rounded-md mb-4 dark:bg-gray-700 dark:text-white"
              placeholder="请输入修改描述，例如：将按钮颜色改为蓝色，文字改为'确认'"
              disabled={isLoading}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeModifyComponentModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleModifyComponentSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                disabled={isLoading || !selectedNodeName}
              >
                修改
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 图生组件模态框 */}
      {showImg2FigmaModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onPaste={handlePaste}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">图生组件</h3>
              {isLoading && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  生成中...
                </div>
              )}
            </div>
            
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              请粘贴或上传图片，将根据图片内容生成组件
            </div>
            
            <div 
              className="w-full h-64 border-2 border-dashed rounded-md flex flex-col items-center justify-center mb-4 dark:border-gray-600 overflow-hidden"
            >
              {imagePreview ? (
                <div className="w-full h-full relative">
                  <img 
                    src={imagePreview} 
                    alt="预览图" 
                    className="object-contain w-full h-full"
                  />
                  <button 
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white rounded-full p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 mb-3">直接粘贴图片到此处</p>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    选择图片文件
                  </button>
                </>
              )}
            </div>
            
            <input 
              type="file" 
              ref={imageInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImg2FigmaModal(false);
                  setImagePreview(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleImg2FigmaSubmit}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center ${isLoading || !imagePreview ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading || !imagePreview}
              >
                {isLoading ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* HTML2Figma Modal */}
      {showHtml2FigmaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">HTML2Figma</h3>
              {isLoading && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  生成中...
                </div>
              )}
            </div>
            <textarea
              value={html2figmaInput}
              onChange={(e) => setHtml2figmaInput(e.target.value)}
              className="w-full h-32 p-2 border rounded-md mb-4 dark:bg-gray-700 dark:text-white"
              placeholder="请输入HTML URL，多个URL请用换行符分隔"
              disabled={isLoading}
            />
            
            {/* 添加进度条组件 */}
            <ImportProgress progress={importProgress} />
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowHtml2FigmaModal(false);
                  setHtml2figmaInput('');
                  setImportProgress({
                    isActive: false,
                    current: 0,
                    total: 0,
                    success: 0,
                    failure: 0,
                    message: ''
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleHtml2FigmaSubmit}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div
        style={{
          height: 1,
          width: "100%",
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      ></div>
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex flex-col items-center px-4 py-2 gap-2 dark:bg-transparent">
          {/* <div className="flex flex-col items-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded">
            <Description selected={props.selectedFramework} />
          </div> */}

          {props.htmlPreview && (
            <Preview
              htmlPreview={{
                content: props.code,
                device: 'mobile',
              }}
              isResponsiveExpanded={isResponsiveExpanded}
              setIsResponsiveExpanded={setIsResponsiveExpanded}
            />
          )}
          {/* <ResponsiveGrade /> */}
          {/* <div className="h-2"></div>
        <div className="flex justify-end w-full mb-1">
          <button className="px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg ring-1 ring-neutral-700 hover:bg-neutral-700 focus:outline-none">
            Copy
          </button>
        </div> */}
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              <p className="text-lg font-medium text-center dark:text-white rounded-lg">
                代码生成
              </p>
            </div>
          </div>

          {enableCodeGen && (
            <CodePanel
              code={props.code}
              selectedFramework={props.selectedFramework}
              preferences={props.preferences}
              onPreferenceChange={props.onPreferenceChange}
            />
          )}
          {props.colors.length > 0 && (
            <ColorsPanel
              colors={props.colors}
              onColorClick={(value) => {
                copy(value);
              }}
            />
          )}

          {props.gradients.length > 0 && (
            <GradientsPanel
              gradients={props.gradients}
              onColorClick={(value) => {
                copy(value);
              }}
            />
          )}
        </div>
      </div>
      <div 
        id="resize-handle"
        className="fixed bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={initResize}
      />
      <MessageModal
        message={modalMessage}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* UX Import Modal */}
      {showUxImportModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">导入UX交互信息</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">请选择UX交互信息的JSON文件</p>
                </div>
                <div className="mt-4">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const jsonData = JSON.parse(event.target?.result as string);
                            window.parent.postMessage(
                              { 
                                pluginMessage: { 
                                  type: 'import-ux-info',
                                  data: jsonData
                                } 
                              },
                              "*"
                            );
                            setShowUxImportModal(false);
                          } catch (error) {
                            alert('无效的JSON文件');
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="w-full p-2 mt-1 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  onClick={() => setShowUxImportModal(false)}
                  className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 属性统计&&修改模态框 */}
      {showPropertyStatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">属性统计 && 修改</h3>
              {isLoading && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                </div>
              )}
            </div>
            
            {selectedNodeName ? (
              <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900 rounded-md">
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  当前选中节点: <strong>{selectedNodeName}</strong>
                </span>
              </div>
            ) : (
              <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900 rounded-md">
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  请先在画布中选择一个节点
                </span>
              </div>
            )}
            
            <textarea
              value={propertyStatInput}
              onChange={(e) => setPropertyStatInput(e.target.value)}
              className="w-full h-32 p-2 border rounded-md mb-4 dark:bg-gray-700 dark:text-white"
              placeholder="请输入您需要进行的属性分析和修改需求..."
              disabled={isLoading}
            />
            
            {/* 添加进度条组件 */}
            <ImportProgress progress={importProgress} />
            
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={closePropertyStatModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handlePropertyStatSubmit}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isLoading || !selectedNodeName ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isLoading || !selectedNodeName}
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ResponsiveGrade = () => {
  return (
    <div className="flex justify-between w-full">
      <span className="text-sm">80% responsive</span>
      <div className="flex items-center checkbox">
        <input id="uniqueId" type="checkbox" className="w-6 checkbox__box" />
        <label htmlFor="uniqueId" className="text-sm checkbox__label">
          Auto-fix
        </label>
      </div>
    </div>
  );
};

type LocalCodegenPreference =
  {
    itemType: "individual_select";
    propertyName: Exclude<
      keyof PluginSettings,
      "framework" | "flutterGenerationMode" | "swiftUIGenerationMode"
    >;
    label: string;
    description: string;
    value?: boolean;
    isDefault?: boolean;
    includedLanguages?: FrameworkTypes[];
  };

export const preferenceOptions: LocalCodegenPreference[] = [
  {
    itemType: "individual_select",
    propertyName: "jsx",
    label: "React (JSX)",
    description: 'Render "class" attributes as "className"',
    isDefault: true,
    includedLanguages: ["HTML", "Tailwind"],
  },
  {
    itemType: "individual_select",
    propertyName: "optimizeLayout",
    label: "优化布局",
    description: 'Attempt to auto-layout suitable element groups',
    isDefault: false,
    includedLanguages: ["HTML", "Tailwind", "Flutter", "SwiftUI"],
  },
  {
    itemType: "individual_select",
    propertyName: "customTailwindColors",
    label: "自适应黑白",
    description: 'Include layer names in classes',
    isDefault: false,
    includedLanguages: ["HTML", "Tailwind"],
  }
];

const selectPreferenceOptions: {
  itemType: "select";
  propertyName: Exclude<keyof PluginSettings, "framework">;
  label: string;
  options: { label: string; value: string; isDefault?: boolean }[];
  includedLanguages?: FrameworkTypes[];
}[] = [
  {
    itemType: "select",
    propertyName: "flutterGenerationMode",
    label: "Mode",
    options: [
      { label: "Full App", value: "fullApp" },
      { label: "Widget", value: "stateless" },
      { label: "Snippet", value: "snippet" },
    ],
    includedLanguages: ["Flutter"],
  },
  {
    itemType: "select",
    propertyName: "swiftUIGenerationMode",
    label: "Mode",
    options: [
      { label: "Preview", value: "preview" },
      { label: "Struct", value: "struct" },
      { label: "Snippet", value: "snippet" },
    ],
    includedLanguages: ["SwiftUI"],
  },
];

export const CodePanel = (props: {
  code: string;
  selectedFramework: FrameworkTypes;
  preferences: PluginSettings | null;
  onPreferenceChange: (key: string, value: boolean | string) => void;
}) => {
  const emptySelection = false;
  const [isPressed, setIsPressed] = useState(false);
  const [syntaxHovered, setSyntaxHovered] = useState(false);
  const [showCodeGen, setShowCodeGen] = useState(true);

  const handleButtonClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 250);
    copy(`create-x:
      image
      \`\`\`${props.code}\`\`\`
      code
      \`\`\`${props.code}\`\`\`
    `);
    window.open("https://frontend.myhexin.com/kingfisher/collector/html/kamis-comp-create/?hexinMatrix=1&&kacreate=1", "_blank");
  };

  if (emptySelection) {
    return (
      <div className="flex flex-col space-y-2 m-auto items-center justify-center p-4 {sectionStyle}">
        <p className="text-lg font-bold">未选中任何图层</p>
        <p className="text-xs">请选中一个图层</p>
      </div>
    );
  } else {
    const selectablePreferencesFiltered = selectPreferenceOptions.filter(
      (preference) =>
        preference.includedLanguages?.includes(props.selectedFramework)
    );

    return (
      <div className="w-full flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <p className="text-lg font-medium text-center dark:text-white rounded-lg">
              代码预览
            </p>
            <button
              onClick={() => setShowCodeGen(!showCodeGen)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                showCodeGen 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100" 
                : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {showCodeGen ? "关闭代码生成" : "开启代码生成"}
            </button>
          </div>
          <button
            onClick={handleButtonClick}
            className={`flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isPressed ? "transform scale-95" : ""
            }`}
          >
            导出到KAmis
          </button>
        </div>

        {showCodeGen && (
          <>
            <div className="flex gap-2 justify-center flex-col p-2 dark:bg-black dark:bg-opacity-25 bg-neutral-100 ring-1 ring-neutral-200 dark:ring-neutral-700 rounded-lg text-sm">
              <div className="flex gap-2 items-center flex-wrap">
                {preferenceOptions
                  .filter((preference) =>
                    preference.includedLanguages?.includes(props.selectedFramework)
                  )
                  .map((preference) => (
                    <SelectableToggle
                      key={preference.propertyName}
                      title={preference.label}
                      description={preference.description}
                      isSelected={
                        props.preferences?.[preference.propertyName] ??
                        preference.isDefault
                      }
                      onSelect={(value) => {
                        props.onPreferenceChange(preference.propertyName, value);
                      }}
                      buttonClass="bg-green-100 dark:bg-black dark:ring-green-800 ring-green-500"
                      checkClass="bg-green-400 dark:bg-black dark:bg-green-500 dark:border-green-500 ring-green-300 border-green-400"
                    />
                  ))}
              </div>
              {selectablePreferencesFiltered.length > 0 && (
                <>
                  <div className="w-full h-px bg-neutral-200 dark:bg-neutral-700" />
                  <div className="flex gap-2 items-center flex-wrap">
                    {selectablePreferencesFiltered.map((preference) => (
                      <>
                        {preference.options.map((option) => (
                          <SelectableToggle
                            key={option.label}
                            title={option.label}
                            isSelected={
                              option.value === props.preferences?.[preference.propertyName] || option.isDefault
                            }
                            onSelect={() => {
                              props.onPreferenceChange(
                                preference.propertyName,
                                option.value
                              );
                            }}
                            buttonClass="bg-blue-100 dark:bg-black dark:ring-blue-800"
                            checkClass="bg-blue-400 dark:bg-black dark:bg-blue-500 dark:border-blue-500 ring-blue-300 border-blue-400"
                          />
                        ))}
                      </>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div
              className={`rounded-lg ring-green-600 transition-all duratio overflow-clip ${
                syntaxHovered ? "ring-2" : "ring-0"
              }`}
            >
              <SyntaxHighlighter
                language="dart"
                style={theme}
                customStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  marginTop: 0,
                  marginBottom: 0,
                  backgroundColor: syntaxHovered ? "#1E2B1A" : "#1B1B1B",
                  transitionProperty: "all",
                  transitionTimingFunction: "ease",
                  transitionDuration: "0.2s",
                }}
              >
                {props.code}
              </SyntaxHighlighter>
            </div>
          </>
        )}
      </div>
    );
  }
};

export const ColorsPanel = (props: {
  colors: {
    hex: string;
    colorName: string;
    exportValue: string;
    contrastWhite: number;
    contrastBlack: number;
  }[];
  onColorClick: (color: string) => void;
}) => {
  const [isPressed, setIsPressed] = useState(-1);

  const handleButtonClick = (value: string, idx: number) => {
    setIsPressed(idx);
    setTimeout(() => setIsPressed(-1), 250);
    props.onColorClick(value);
  };

  return (
    <div className="bg-gray-100 dark:bg-neutral-900 w-full rounded-lg p-2 flex flex-col gap-2">
      <h2 className="text-gray-800 dark:text-gray-200 text-lg font-medium">
        Colors
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {props.colors.map((color, idx) => (
          <button
            key={"button" + idx}
            className={`w-full h-16 rounded-lg text-sm font-semibold shadow-sm transition-all duration-300 ${
              isPressed === idx
                ? "ring-4 ring-green-300 ring-opacity-50 animate-pulse"
                : "ring-0"
            }`}
            style={{ backgroundColor: color.hex }}
            onClick={() => {
              handleButtonClick(color.exportValue, idx);
            }}
          >
            <div className="flex flex-col h-full justify-center items-center">
              <span
                className={`text-xs font-semibold ${
                  color.contrastWhite > color.contrastBlack
                    ? "text-white"
                    : "text-black"
                }`}
              >
                {color.colorName ? color.colorName : `#${color.hex}`}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const GradientsPanel = (props: {
  gradients: { cssPreview: string; exportValue: string }[];
  onColorClick: (color: string) => void;
}) => {
  const [isPressed, setIsPressed] = useState(-1);

  const handleButtonClick = (value: string, idx: number) => {
    setIsPressed(idx);
    setTimeout(() => setIsPressed(-1), 250);
    props.onColorClick(value);
  };

  return (
    <div className="bg-gray-100 dark:bg-neutral-900 w-full rounded-lg p-2 flex flex-col gap-2">
      <h2 className="text-gray-800 dark:text-gray-200 text-lg font-medium">
        Gradients
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {props.gradients.map((gradient, idx) => (
          <button
            key={"button" + idx}
            className={`w-full h-16 rounded-lg text-sm shadow-sm transition-all duration-300 ${
              isPressed === idx
                ? "ring-4 ring-green-300 ring-opacity-50 animate-pulse"
                : "ring-0"
            }`}
            style={{ background: gradient.cssPreview }}
            onClick={() => {
              handleButtonClick(gradient.exportValue, idx);
            }}
          ></button>
        ))}
      </div>
    </div>
  );
};

type SelectableToggleProps = {
  onSelect: (isSelected: boolean) => void;
  isSelected?: boolean;
  title: string;
  description?: string;
  buttonClass: string;
  checkClass: string;
};

const SelectableToggle = ({
  onSelect,
  isSelected = false,
  title,
  description,
  buttonClass,
  checkClass,
}: SelectableToggleProps) => {
  const handleClick = () => {
    onSelect(!isSelected);
  };

  return (
    <button
      onClick={handleClick}
      title={description}
      className={`h-8 px-2 truncate flex items-center justify-center rounded-md cursor-pointer transition-all duration-300
      hover:bg-neutral-200 dark:hover:bg-neutral-700 gap-2 text-sm ring-1 
      ${
        isSelected
          ? buttonClass
          : "bg-neutral-100 dark:bg-neutral-800 dark:ring-neutral-700 ring-neutral-300"
      }`}
    >
      <span
        className={`h-3 w-3 flex-shrink-0 border-2 ${
          isSelected
            ? checkClass
            : "bg-transparent border-neutral-500 dark:border-neutral-500"
        }`}
        style={{
          borderRadius: 4,
        }}
      />
      {title}
    </button>
  );
};

export const Preview: React.FC<{
  htmlPreview: {
    device: "desktop" | "mobile";
    content: string;
  };
  isResponsiveExpanded: boolean;
  setIsResponsiveExpanded: (value: boolean) => void;
}> = (props) => {
  const previewWidths = [45, 80, 140];
  const labels = ["sm", "md", "lg"];

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reactCodeWrapper = () => {

    // class的特殊字符转义
    
    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>React with CDN</title>
        <!-- 引入Tailwind CSS -->
        <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          <div id="root"></div>

          <!-- 引入React -->
          <script crossorigin src="https://cdn.jsdelivr.net/npm/react@17.0.2/umd/react.production.min.js"></script>
          <!-- 引入ReactDOM -->
          <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@17.0.2/umd/react-dom.production.min.js"></script>

          <!-- 引入Babel -->
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <!-- 你的JS代码 -->
          <script type="text/babel">
            const App = () => {
              return (
  ${props.htmlPreview.content}
              )
            }
            ReactDOM.render(<App />, document.getElementById('root'));
          </script>
        </body>
      </html>`;
  };

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(reactCodeWrapper());
        doc.close();
      }
    }
  }, [props.htmlPreview.content]);

  return (
    <div className="flex flex-col w-full">
      <div className="py-1.5 flex gap-2 w-full text-lg font-medium text-center dark:text-white rounded-lg justify-between">
        <span>代码预览</span>
        <button
          className={`px-2 py-1 text-sm font-semibold border border-green-500 rounded-md shadow-sm hover:bg-green-500 dark:hover:bg-green-600 hover:text-white hover:border-transparent transition-all duration-300 ${"bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"}`}
          onClick={() => {
            props.setIsResponsiveExpanded(!props.isResponsiveExpanded);
          }}
        >
          <ExpandIcon size={16} />
        </button>
      </div>
      <div className="flex gap-2 justify-center items-center">
            <div
              key={"preview "}
              className="relative flex flex-col items-center"
              style={{ width: 375 }}
            >
              <div
                className="flex flex-col justify-center items-center"
                style={{
                  width: 375,
                  height: 750,
                  clipPath: "inset(0px round 6px)",
                }}
              >
                {/* <div
                  style={{
                    zoom: scaleFactor,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: props.htmlPreview.content,
                  }}
                /> */}
                <iframe
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  ref={iframeRef}
                  title="preview"
                  className={classNames(
                    "border-[4px] border-black rounded-[20px] shadow-lg",
                    "transform scale-[0.9] origin-top",
                    {
                      "w-full h-[832px]": props.htmlPreview.device === "desktop",
                      "w-[400px] h-[832px]": props.htmlPreview.device === "mobile",
                    }
                  )}
                ></iframe>
              </div>
              {/* <span className="mt-auto text-xs text-gray-500">
                {labels}
              </span> */}
            </div>
      </div>
    </div>
  );
};

export const viewDocumentationWebsite = () => {
  return (
    <div className="p-4 bg-neutral-100 dark:bg-neutral-700 rounded-md shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
        Documentation
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
        Learn how to use our Figma plugin and explore its features in detail by
        visiting our documentation website.
      </p>
      <a
        href="https://documentation.example.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-500 transition-colors duration-300"
      >
        Visit Documentation Website &rarr;
      </a>
    </div>
  );
};

const ExpandIcon = (props: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM101.66,53.66,120,35.31V96a8,8,0,0,0,16,0V35.31l18.34,18.35a8,8,0,0,0,11.32-11.32l-32-32a8,8,0,0,0-11.32,0l-32,32a8,8,0,0,0,11.32,11.32Zm52.68,148.68L136,220.69V160a8,8,0,0,0-16,0v60.69l-18.34-18.35a8,8,0,0,0-11.32,11.32l32,32a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Z"></path>
  </svg>
);

const initResize = (e: React.MouseEvent) => {
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = document.documentElement.offsetWidth;
  const startHeight = document.documentElement.offsetHeight;
  
  const resize = (e: MouseEvent) => {
    const newWidth = startWidth + (e.clientX - startX);
    const newHeight = startHeight + (e.clientY - startY);
    parent.postMessage({ 
      pluginMessage: { 
        type: 'resize',
        width: Math.max(newWidth, 450), // 设置最小宽度
        height: Math.max(newHeight, 550) // 设置最小高度
      } 
    }, '*');
  };

  const stopResize = () => {
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  };

  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
};

// 在顶部导入区域下方添加进度条组件
export type ProgressState = {
  isActive: boolean;
  current: number;
  total: number;
  success: number;
  failure: number;
  message: string;
};

// 添加进度条组件
const ImportProgress: React.FC<{
  progress: ProgressState;
}> = ({ progress }) => {
  if (!progress.isActive) return null;
  
  // 计算进度百分比
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  
  return (
    <div className="mt-2 mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {progress.message || `处理中 (${progress.current}/${progress.total})`}
        </span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{percent}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      {progress.success > 0 || progress.failure > 0 ? (
        <div className="flex justify-between mt-1 text-xs">
          <span className="text-green-600 dark:text-green-400">
            成功: {progress.success}
          </span>
          <span className="text-red-600 dark:text-red-400">
            失败: {progress.failure}
          </span>
        </div>
      ) : null}
    </div>
  );
};
