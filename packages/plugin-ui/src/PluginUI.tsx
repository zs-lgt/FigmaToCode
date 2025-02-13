import { useState, useRef, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark as theme } from "react-syntax-highlighter/dist/esm/styles/prism";
import copy from "copy-to-clipboard";
import classNames from "classnames";

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

export const PluginUI = (props: PluginUIProps) => {
  const [isResponsiveExpanded, setIsResponsiveExpanded] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [enableCodeGen, setEnableCodeGen] = useState(true);

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

  const handleImportHtml = () => {
    setShowHtmlModal(true);
  }

  const handleImportJson = () => {
    try {
      const jsonData = JSON.parse(jsonInput);
      window.parent.postMessage(
        { pluginMessage: { type: "import-figma-json", data: jsonData } },
        "*"
      );
      setShowJsonModal(false);
      setJsonInput('');
    } catch (error) {
      console.error('JSON parsing error:', error);
      alert('Invalid JSON format');
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

  const handleExportSelectedNodesClick = () => {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'export-selected-nodes',
        optimize: true,
      }
    }, '*');
  };

  const handleConfirmHtmlModal = () => {
    if (!htmlContent.trim()) return;
                    
    parent.postMessage({
      pluginMessage: {
        type: 'import-html',
        html: htmlContent,
      }
    }, '*');
                    
    setShowHtmlModal(false);
    setHtmlContent('');
  };

  const handleCancelHtmlModal = () => {
    setShowHtmlModal(false);
    setHtmlContent('');
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
          className="px-3 py-1 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm"
          onClick={handleImportHtml}
        >
          导入Html
        </button>
        {showHtmlModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-lg font-semibold mb-4">输入HTML代码（支持HTML+TailwindCSS）</h2>
              <textarea
                className="w-full h-64 p-2 border border-gray-300 rounded-md mb-4 font-mono"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="请输入HTML代码..."
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  onClick={handleCancelHtmlModal}
                >
                  取消
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md"
                  onClick={handleConfirmHtmlModal}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowJsonModal(true)}
          className="px-3 py-1 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-md shadow-sm"
        >
          导入JSON
        </button>

        <div className="flex space-x-2">
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
            导出设计信息（完整版）
          </button>
        </div>
      </div>

      {/* JSON Import Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowJsonModal(false)}></div>
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">导入 Figma JSON</h3>
              <button
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
                onClick={() => setShowJsonModal(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <textarea
              className="w-full h-64 p-2 border rounded-md dark:bg-neutral-700 dark:border-neutral-600 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="粘贴 Figma JSON 数据..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors"
                onClick={() => {
                  setShowJsonModal(false);
                  setJsonInput('');
                }}
              >
                取消
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                onClick={handleImportJson}
              >
                导入
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
  // | {
  //     itemType: "alternative-unit";
  //     defaultScaleFactor: number;
  //     scaledUnit: string;
  //     default?: boolean;
  //     includedLanguages?: FrameworkTypes[];
  //   }
  // | {
  //     itemType: "select";
  //     propertyName: Exclude<keyof PluginSettings, "framework">;
  //     label: string;
  //     options: { label: string; value: string; isDefault?: boolean }[];
  //     includedLanguages?: FrameworkTypes[];
  //   }
  // | {
  //     itemType: "action";
  //     propertyName: string;
  //     label: string;
  //     includedLanguages?: FrameworkTypes[];
  //   }
  // |
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
  // {
  //   itemType: "individual_select",
  //   propertyName: "inlineStyle",
  //   label: "内联样式",
  //   description: 'Inline style',
  //   isDefault: false,
  //   includedLanguages: ["HTML"],
  // },
  // {
  //   itemType: "individual_select",
  //   propertyName: "responsiveRoot",
  //   label: "Responsive Root",
  //   isDefault: false,
  //   includedLanguages: ["Tailwind"],
  // },
  {
    itemType: "individual_select",
    propertyName: "optimizeLayout",
    label: "优化布局",
    description: 'Attempt to auto-layout suitable element groups',
    isDefault: false,
    includedLanguages: ["HTML", "Tailwind", "Flutter", "SwiftUI"],
  },
  // {
  //   itemType: "individual_select",
  //   propertyName: "layerName",
  //   label: "Layer names",
  //   description: 'Include layer names in classes',
  //   isDefault: false,
  //   includedLanguages: ["HTML", "Tailwind"],
  // },
  // {
  //   itemType: "individual_select",
  //   propertyName: "roundTailwindValues",
  //   label: "Round values",
  //   description: 'Round pixel values to nearest Tailwind sizes',
  //   isDefault: false,
  //   includedLanguages: ["Tailwind"],
  // },
  // {
  //   itemType: "individual_select",
  //   propertyName: "roundTailwindColors",
  //   label: "Round colors",
  //   description: 'Round color values to nearest Tailwind colors',
  //   isDefault: false,
  //   includedLanguages: ["Tailwind"],
  // },
  // {
  //   itemType: "individual_select",
  //   propertyName: "customTailwindColors",
  //   label: "Custom colors",
  //   description: 'Use color variable names as custom color names',
  //   isDefault: false,
  //   includedLanguages: ["Tailwind"],
  // },
  {
    itemType: "individual_select",
    propertyName: "customTailwindColors",
    label: "自适应黑白",
    description: 'Include layer names in classes',
    isDefault: false,
    includedLanguages: ["HTML", "Tailwind"],
  }
  // Add your preferences data here
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
  // {
  //   itemType: "select",
  //   propertyName: "htmlGenerationMode",
  //   label: "Mode",
  //   options: [
  //     { label: "Component", value: "component" },
  //     { label: "Snippet", value: "snippet" },
  //   ],
  //   includedLanguages: ["HTML"],
  // },
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

// export const PrevColorsPanel = (props: {
//   colors: {
//     hex: string;
//     colorName: string;
//     exportValue: string;
//     contrastWhite: number;
//     contrastBlack: number;
//   }[];
//   // onColorClick: (color: string) => void;
// }) => {
//   return (
//     <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
//       <div className="container mx-auto p-4">
//         <div className="flex flex-wrap items-start space-x-2 lg:space-x-0">
//           <div className="flex-1 min-w-0">
//             <h2 className="text-gray-800 dark:text-gray-200 mb-2">Text</h2>
//             {["Button1", "Button2", "Button3"].map((button, idx) => (
//               <button
//                 key={idx}
//                 className="bg-white dark:bg-gray-800 p-2 mb-1 rounded-lg focus:outline-none focus:ring-0 hover:bg-gray-200 dark:hover:bg-gray-700 w-full transition"
//               >
//                 <div className="flex flex-col">
//                   <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
//                     Tt
//                   </span>
//                   <span className="text-xs text-gray-500 dark:text-gray-400">
//                     {button}
//                   </span>
//                 </div>
//               </button>
//             ))}
//           </div>
//           <div className="flex-1 lg:max-w-[200px]">
//             <h2 className="text-gray-800 dark:text-gray-200 mb-2">Colors</h2>
//             <div className="flex flex-wrap">
//               {["red-500", "yellow-500", "blue-500"].map((color, idx) => (
//                 <button
//                   key={idx}
//                   className={`bg-${color} w-full sm:w-1/2 lg:w-full h-16 mb-1 rounded-lg focus:outline-none focus:ring-0 transition`}
//                 >
//                   <div className="flex flex-col h-full justify-center items-center">
//                     <span className="text-xs font-semibold text-white">
//                       Color{idx + 1}
//                     </span>
//                   </div>
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

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
          className={`px-2 py-1 text-sm font-semibold border border-green-500 rounded-md shadow-sm hover:bg-green-500 dark:hover:bg-green-600 hover:text-white hover:border-transparent transition-all duration-300 ${"bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600"}`}
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
