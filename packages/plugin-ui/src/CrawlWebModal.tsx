import { useState, useEffect } from "react";
import copy from "copy-to-clipboard";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark as theme } from "react-syntax-highlighter/dist/esm/styles/prism";

// 定义组件属性接口
interface CrawlWebModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 网页抓取功能弹窗组件
 * 包含功能：
 * 1. 输入网页地址，开启抓取任务，并显示抓取任务的id，id可以复制
 * 2. 可以输入任务id查询抓取任务完成状态
 * 3. 如果状态为已完成，获取抓取结果的zip，并获取到zip中的文件内容
 */
const CrawlWebModal: React.FC<CrawlWebModalProps> = ({ 
  isOpen, 
  onClose
}) => {
  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [crawlWebInput, setCrawlWebInput] = useState('');
  const [crawlTaskId, setCrawlTaskId] = useState('');
  const [crawlTaskIdInput, setCrawlTaskIdInput] = useState('');
  const [crawlTaskStatus, setCrawlTaskStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [crawlTaskResult, setCrawlTaskResult] = useState<{[filename: string]: string | ArrayBuffer} | null>(null);
  const [crawlTaskFiles, setCrawlTaskFiles] = useState<string[]>([]);
  const [selectedCrawlFile, setSelectedCrawlFile] = useState<string>('');
  const [crawlFileContent, setCrawlFileContent] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // 重置状态
  const resetState = () => {
    setCrawlWebInput('');
    setCrawlTaskId('');
    setCrawlTaskIdInput('');
    setCrawlTaskStatus('idle');
    setCrawlTaskResult(null);
    setCrawlTaskFiles([]);
    setSelectedCrawlFile('');
    setCrawlFileContent('');
    setErrorMessage('');
    setIsCopied(false);
  };
  
  // 处理获取抓取任务结果
  const handleGetCrawlTaskResult = async (taskId: string) => {
    try {
      if (!taskId) {
        setErrorMessage('任务ID不能为空');
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: 'get-crawl-task-result',
            taskId: taskId
          } 
        },
        '*'
      );
    } catch (error: any) {
      setIsLoading(false);
      setErrorMessage(`发送请求失败: ${error.message || String(error)}`);
    }
  };

  // 处理网页抓取提交
  const handleCrawlWebSubmit = async () => {
    try {
      if (!crawlWebInput.trim()) {
        setErrorMessage('请输入网页URL');
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      
      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: 'crawl-html',
            url: crawlWebInput
          } 
        },
        '*'
      );
    } catch (error: any) {
      setIsLoading(false);
      setErrorMessage(`发送请求失败: ${error.message || String(error)}`);
    }
  };

  // 处理查询抓取任务状态
  const handleCheckCrawlTaskStatus = async () => {
    try {
      const taskId = crawlTaskIdInput || crawlTaskId;
      if (!taskId) {
        setErrorMessage('请输入任务ID');
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      setCrawlTaskId(taskId);

      // 发送消息到插件后端处理API调用
      window.parent.postMessage(
        { 
          pluginMessage: { 
            type: 'get-crawl-task-status',
            taskId: taskId
          } 
        },
        '*'
      );
    } catch (error: any) {
      setIsLoading(false);
      setErrorMessage(`发送请求失败: ${error.message || String(error)}`);
    }
  };

  // 处理查看文件内容
  const handleViewCrawlFile = (filename: string) => {
    if (!crawlTaskResult) return;
    
    const content = crawlTaskResult[filename];
    if (typeof content === 'string') {
      setSelectedCrawlFile(filename);
      setCrawlFileContent(content);
    } else {
      setErrorMessage(`无法显示二进制文件内容: ${filename}`);
    }
  };

  // 复制任务ID
  const handleCopyCrawlTaskId = () => {
    copy(crawlTaskId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 获取文件类型
  const getFileType = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
      case 'json': return 'json';
      case 'txt': return 'text';
      default: return 'text';
    }
  };

  const handleImportCrawlTaskResult = () => {
    if (!crawlTaskResult) return;
    const uiJsonContent = crawlTaskResult['ui'];
    const uxJsonContent = crawlTaskResult['ux'];
    console.log('uiJsonContent', crawlTaskResult);
    // 只发送UI文件内容到插件
    window.parent.postMessage(
      { 
        pluginMessage: { 
          type: 'import-ui-ux-json',
          data: {
            uiJson: uiJsonContent,
            uxJson: uxJsonContent,
          }
        } 
      },
      "*"
    );
  };

  // 处理插件消息
  useEffect(() => {
    const handlePluginMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage;
      if (!message) return;

      // 处理抓取网页响应
      if (message.type === 'crawl-html-response') {
        setIsLoading(false);
        if (message.success) {
          setCrawlTaskId(message.taskId);
          setCrawlTaskStatus('running');
        } else {
          setErrorMessage(`抓取网页失败: ${message.error || '未知错误'}`);
        }
      }
      // 处理查询任务状态响应
      else if (message.type === 'crawl-task-status-response') {
        setIsLoading(false);
        if (message.success) {
          setCrawlTaskStatus(message.status);
          // 如果任务已完成，自动获取结果
          if (message.status === 'completed') {
            handleGetCrawlTaskResult(message.taskId);
          }
        } else {
          setErrorMessage(`查询任务状态失败: ${message.error || '未知错误'}`);
        }
      }
      // 处理获取任务结果响应
      else if (message.type === 'crawl-task-result-response') {
        setIsLoading(false);
        if (message.success) {
          setCrawlTaskResult(message.result);
          setCrawlTaskFiles(Object.keys(message.result));
        } else {
          setErrorMessage(`获取任务结果失败: ${message.error || '未知错误'}`);
        }
      }
    };

    window.addEventListener('message', handlePluginMessage);
    return () => window.removeEventListener('message', handlePluginMessage);
  }, []);

  // 关闭弹窗时重置状态
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  // 如果任务ID存在且状态为运行中，每10秒查询一次任务状态
  useEffect(() => {
    let intervalId: number | null = null;
    
    if (crawlTaskId && crawlTaskStatus !== 'completed' && isOpen) {
      // 创建定时器，每10秒查询一次任务状态
      intervalId = window.setInterval(() => {
        // 发送消息到插件后端处理API调用
        window.parent.postMessage(
          { 
            pluginMessage: { 
              type: 'get-crawl-task-status',
              taskId: crawlTaskId
            } 
          },
          '*'
        );
        console.log('自动查询任务状态:', crawlTaskId);
      }, 10000); // 10秒 = 10000毫秒
    }
    
    // 清理定时器
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [crawlTaskId, crawlTaskStatus, isOpen]); // 依赖项包括任务ID、状态和弹窗是否打开

  // 如果不显示，则返回null
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium dark:text-white">网页抓取</h3>
          {isLoading && (
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              处理中...
            </div>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 错误消息 */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-md">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 overflow-auto">
          <div className="w-full md:w-1/2 flex flex-col">
            {/* 任务创建区域 */}
            <div className="mb-4 p-4 border dark:border-gray-700 rounded-md">
              <h4 className="text-md font-medium mb-2 dark:text-white">创建抓取任务</h4>
              <div className="flex">
                <input
                  type="text"
                  value={crawlWebInput}
                  onChange={(e) => setCrawlWebInput(e.target.value)}
                  className="flex-grow p-2 border rounded-l-md dark:bg-gray-700 dark:text-white"
                  placeholder="请输入网页URL"
                  disabled={isLoading || crawlTaskStatus !== 'idle'}
                />
                <button
                  onClick={handleCrawlWebSubmit}
                  className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-r-md hover:bg-blue-700 ${(isLoading || crawlTaskStatus !== 'idle') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isLoading || crawlTaskStatus !== 'idle'}
                >
                  抓取
                </button>
              </div>
            </div>

            {/* 任务ID和状态区域 */}
            <div className="mb-4 p-4 border dark:border-gray-700 rounded-md">
              <h4 className="text-md font-medium mb-2 dark:text-white">任务状态查询</h4>
              
              {/* 显示当前任务ID */}
              {crawlTaskId && (
                <div className="mb-2">
                  <div className="flex items-center mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">当前任务ID:</span>
                    <div className="flex-grow flex items-center">
                      <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-sm mr-2 overflow-x-auto">
                        {crawlTaskId}
                      </code>
                      <button
                        onClick={handleCopyCrawlTaskId}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center"
                        title="复制任务ID"
                      >
                        {isCopied ? (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            复制
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">状态:</span>
                    <span className={`text-sm font-medium ${crawlTaskStatus === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {crawlTaskStatus === 'running' ? '运行中' : crawlTaskStatus === 'completed' ? '已完成' : '未开始'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* 输入任务ID查询 */}
              <div className="flex">
                <input
                  type="text"
                  value={crawlTaskIdInput}
                  onChange={(e) => setCrawlTaskIdInput(e.target.value)}
                  className="flex-grow p-2 border rounded-l-md dark:bg-gray-700 dark:text-white"
                  placeholder="输入任务ID查询状态"
                  disabled={isLoading}
                />
                <button
                  onClick={handleCheckCrawlTaskStatus}
                  className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-r-md hover:bg-blue-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isLoading}
                >
                  查询
                </button>
              </div>
            </div>

            {/* 文件列表区域 */}
            {crawlTaskStatus === 'completed' && crawlTaskFiles.length > 0 && (
              <div className="p-4 border dark:border-gray-700 rounded-md overflow-auto">
                <h4 className="text-md font-medium mb-2 dark:text-white">抓取结果文件</h4>
                <div className="max-h-[300px] overflow-y-auto">
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {crawlTaskFiles.map((filename) => (
                      <li key={filename} className="py-2">
                        <button
                          onClick={() => handleViewCrawlFile(filename)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedCrawlFile === filename ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                          {filename}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* 文件内容预览区域 */}
          <div className="w-full md:w-1/2">
            {selectedCrawlFile && crawlFileContent ? (
              <div className="border dark:border-gray-700 rounded-md overflow-hidden h-full">
                <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 border-b dark:border-gray-700 flex justify-between items-center">
                  <h4 className="text-md font-medium dark:text-white">{selectedCrawlFile}</h4>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <SyntaxHighlighter
                    language={getFileType(selectedCrawlFile)}
                    style={theme}
                    customStyle={{ margin: 0, borderRadius: 0 }}
                    showLineNumbers
                  >
                    {crawlFileContent}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <div className="border dark:border-gray-700 rounded-md p-6 flex items-center justify-center h-full">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {crawlTaskStatus === 'completed' ? '选择文件查看内容' : '等待任务完成...'}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleImportCrawlTaskResult}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            导入
          </button>
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrawlWebModal;
