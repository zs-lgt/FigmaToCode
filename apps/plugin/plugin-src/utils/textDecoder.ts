/**
 * 将 Uint8Array 转换为字符串，正确处理 UTF-8 编码的中文字符
 * @param {Uint8Array} array 要转换的 Uint8Array
 * @returns {string} 转换后的字符串
 */
export const uint8ArrayToString = (array: Uint8Array): string => {
  // 方法 1: 使用 decodeURIComponent 和 escape 函数处理 UTF-8 编码
  try {
    // 首先将 Uint8Array 转换为单字节字符串
    let binaryString = '';
    for (let i = 0; i < array.length; i++) {
      binaryString += String.fromCharCode(array[i]);
    }
    
    // 然后使用 escape 和 decodeURIComponent 函数正确处理 UTF-8 编码
    // escape 将非 ASCII 字符转换为 %XX 形式，decodeURIComponent 可以正确解析 UTF-8 字节序列
    return decodeURIComponent(escape(binaryString));
  } catch (e) {
    // 如果上述方法失败，回退到方法 2
    
    // 方法 2: 手动解析 UTF-8 编码
    let result = '';
    let i = 0;
    
    while (i < array.length) {
      // 获取当前字节
      const byte1 = array[i++];
      
      // ASCII 字符 (0-127)
      if (byte1 < 128) {
        result += String.fromCharCode(byte1);
        continue;
      }
      
      // 判断 UTF-8 字符的字节数
      let bytesNeeded = 0;
      let codePoint = 0;
      
      // 2 字节 UTF-8 字符 (开头是 110xxxxx)
      if ((byte1 & 0xE0) === 0xC0) {
        bytesNeeded = 1;
        codePoint = byte1 & 0x1F;
      }
      // 3 字节 UTF-8 字符 (开头是 1110xxxx)
      else if ((byte1 & 0xF0) === 0xE0) {
        bytesNeeded = 2;
        codePoint = byte1 & 0x0F;
      }
      // 4 字节 UTF-8 字符 (开头是 11110xxx)
      else if ((byte1 & 0xF8) === 0xF0) {
        bytesNeeded = 3;
        codePoint = byte1 & 0x07;
      }
      
      // 读取额外的字节
      for (let j = 0; j < bytesNeeded; j++) {
        // 确保我们没有超出数组范围
        if (i >= array.length) break;
        
        const byte = array[i++];
        // 确保这是一个有效的 UTF-8 后续字节 (10xxxxxx)
        if ((byte & 0xC0) !== 0x80) {
          i--;  // 回退一个字节
          break;
        }
        
        // 添加到 codePoint
        codePoint = (codePoint << 6) | (byte & 0x3F);
      }
      
      // 将 codePoint 转换为字符
      if (codePoint <= 0xFFFF) {
        result += String.fromCharCode(codePoint);
      } else {
        // 处理需要代理对的字符 (> 0xFFFF)
        codePoint -= 0x10000;
        result += String.fromCharCode(
          (codePoint >> 10) + 0xD800,  // 高代理项
          (codePoint & 0x3FF) + 0xDC00  // 低代理项
        );
      }
    }
    
    return result;
  }
}
