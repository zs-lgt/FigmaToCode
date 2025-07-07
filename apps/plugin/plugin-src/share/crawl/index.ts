import { startCrawlTaskApi, getCrawlTaskStatusApi, getCrawlTaskResultApi, getCrawlTaskResultApiV2 } from '../../api';
// 导入 fflate，使用同步 API
// 注意：Figma 插件环境不支持 Web Workers
import { unzipSync } from 'fflate';
import { uint8ArrayToString } from '../../utils/textDecoder'


export const crawlHtml = async (url: string) => {
  const { task_id } = await startCrawlTaskApi(url);
  return task_id;
}


export const getCrawlTaskStatus = async (task_id: string) => {
  const { status } = await getCrawlTaskStatusApi(task_id);
  return status;
}


/**
 * 获取爬取任务结果并解析zip压缩包
 * @param {string} task_id 任务ID
 * @returns {Promise<{[filename: string]: string | ArrayBuffer}>} 解析后的文件内容映射
 */
export const getCrawlTaskResult = async (task_id: string) => {

  const { ui, ux } = await getCrawlTaskResultApiV2(task_id);
  return { ui, ux };
  // 获取 zip 文件的 ArrayBuffer
  // const zipBuffer = await getCrawlTaskResultApi(task_id);
  
  // try {
  //   console.log('zipBuffer', zipBuffer);
    
  //   // 存储解析结果的对象
  //   // 仅使用 ArrayBuffer 而不是 SharedArrayBuffer 来避免类型兼容性问题
  //   const result: { [filename: string]: string | ArrayBuffer } = {};
    
  //   // 使用 fflate 的同步 API 解压 zip 文件
  //   // 将 ArrayBuffer 转换为 Uint8Array，fflate 需要这种格式
  //   const zipData = new Uint8Array(zipBuffer);
    
  //   // 使用同步 API 直接解压
  //   const unzipped = unzipSync(zipData);
  //   console.log('unzipped', unzipped);
    
  //   // 处理解压后的文件
  //   for (const filename in unzipped) {
  //     console.log('filename', filename);
  //     const fileData = unzipped[filename];
      
  //     // 根据文件类型决定如何处理
  //     if (filename.endsWith('.html') || filename.endsWith('.css') || 
  //         filename.endsWith('.js') || filename.endsWith('.json') || 
  //         filename.endsWith('.txt')) {
  //       // 文本文件转换为字符串
  //       // 使用更兼容的方法将 Uint8Array 转换为字符串
  //       result[filename] = uint8ArrayToString(fileData);
  //     } else {
  //       // 二进制文件处理
  //       // 创建一个新的 ArrayBuffer 来避免类型兼容性问题
  //       const buffer = fileData.buffer;
  //       // 确保我们处理的是 ArrayBuffer 而不是 SharedArrayBuffer
  //       if (buffer instanceof ArrayBuffer) {
  //         result[filename] = buffer;
  //       } else {
  //         // 如果是 SharedArrayBuffer，创建一个新的 ArrayBuffer 并复制数据
  //         const newBuffer = new ArrayBuffer(fileData.length);
  //         const newView = new Uint8Array(newBuffer);
  //         const oldView = new Uint8Array(buffer);
  //         newView.set(oldView);
  //         result[filename] = newBuffer;
  //       }
  //     }
  //   }
  //   console.log('result', result);
  //   return result;
  // } catch (error: any) {
  //   // 处理解析错误
  //   console.error('解析 zip 文件失败:', error);
  //   throw new Error(`解析 zip 文件失败: ${error.message || String(error)}`);
  // }
};
