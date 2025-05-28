
/**
 * 带超时的fetch请求，使用Promise.race实现
 * @param {string} url 请求URL
 * @param {RequestInit} options 请求选项
 * @param {number} timeout 超时时间（毫秒）
 * @returns {Promise<Response>} 响应对象
 */
export const fxios = async (url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> => {
  // 创建一个超时Promise
  const timeoutPromise = new Promise<Response>((_, reject) => {
    const timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      reject(new Error(`请求超时 (超过 ${timeout/1000} 秒)`));
    }, timeout);
  });
  
  // 创建实际的fetch Promise
  const fetchPromise = fetch(url, options);
  
  // 使用Promise.race竞争，哪个先完成就返回哪个
  return Promise.race([fetchPromise, timeoutPromise]);
}
