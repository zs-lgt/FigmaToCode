
// 处理API请求的通用方法
export const callNL2FigmaAPI = async (query: string, history: any[] = [], traceId: string = '123') => {
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
export const callImg2FigmaAPI = async (img_base64: string, traceId: string = '123') => {
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
export const callHtml2FigmaAPI = async (url: string, traceId: string = '123') => {
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

  const result = await response.json();
  
  // 添加详细日志输出，便于诊断
  console.log('HTML2Figma API响应详情:', {
    status: result.status,
    hasFigmaJson: !!result.figma_json,
    hasAnalysisJson: !!result.analysis_json,
    hasLlmout: !!result.llmout
  });
  
  return result;
};