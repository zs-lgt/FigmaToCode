
/**
 * 创建multipart/form-data边界字符串
 * @returns {string} 边界字符串
 */
export const createFormDataBoundary = (): string => {
  return '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
}

/**
 * 创建 multipart/form-data 格式的请求体，figma插件环境中不支持node原生的FormData
 * @param {string} boundary 边界字符串
 * @param {Record<string, string>} fields 表单字段
 * @returns {string} 格式化的请求体
 */
export const createFormDataBody = (boundary: string, fields: Record<string, string>): string => {
  let body = '';
  
  // 添加每个字段
  Object.entries(fields).forEach(([key, value]) => {
    body += '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="' + key + '"\r\n\r\n';
    body += value + '\r\n';
  });
  
  // 添加结束边界
  body += '--' + boundary + '--\r\n';
  
  return body;
}