import { createFormDataBody, createFormDataBoundary } from '../utils/formData';
import { fxios } from '../utils/fetch'

// 爬取任务接口返回类型
interface proccessCrawlTaskResponse {
  task_id: string;
  message: string;
}

// 获取爬取任务状态接口返回类型
interface getCrawlTaskStatusResponse {
  status: 'running' | 'completed';
  output_zip_exists: boolean;
  latest_logs: string[];
  returncode: number;
  total_log_lines: number;
}

const CRAWL_API_BASE_URL = 'https://occ.10jqka.com.cn/process_image';

/**
 * 提交爬取任务
 * @param {string} url 爬取的URL
 * @returns {proccessCrawlTaskResponse} 启动爬取任务的响应
 */
export const startCrawlTaskApi = async (url: string): Promise<proccessCrawlTaskResponse> => {
  const API_BASE_URL = `${CRAWL_API_BASE_URL}/submit-task`;

  const boundary = createFormDataBoundary();
  const formDataBody = createFormDataBody(boundary, { url });

  // 使用带超时的fetch，设置60秒超时（提交任务可能需要较长时间）
  const response = await fxios(`${API_BASE_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: formDataBody
  }, 10000);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * 获取爬取任务状态
 * @param {string} task_id 任务ID
 * @returns {getCrawlTaskStatusResponse} 任务状态
 */
export const getCrawlTaskStatusApi = async (task_id: string): Promise<getCrawlTaskStatusResponse> => {
  const API_BASE_URL = `${CRAWL_API_BASE_URL}/task-status/${task_id}`;
  const response = await fxios(`${API_BASE_URL}`, {
    method: 'GET',
    headers: {},
  }, 10000);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * 获取爬取任务结果并解析zip压缩包
 * @param {string} task_id 任务ID
 * @returns {ArrayBuffer} 解析后的文件内容
 */
export const getCrawlTaskResultApi = async (task_id: string): Promise<ArrayBuffer> => {
  const API_BASE_URL = `${CRAWL_API_BASE_URL}/download-result/${task_id}`;
  const response = await fxios(`${API_BASE_URL}`, {
    method: 'GET',
  }, 10000);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  // 检查Content-Type，应该是application/zip或application/octet-stream
  console.log('Content-Type:', response);
  
  const contentType = (response as any).headersObject['content-type'];
  if (contentType && contentType.includes('application/zip')) {
    // 获取二进制数据
    const zipData = await response.arrayBuffer();    
    return zipData;
  } else {
    throw new Error(`Unexpected Content-Type: ${contentType}, expected application/zip or application/octet-stream`);
  }
};