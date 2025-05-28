/**
 * 将 Uint8Array 转换为字符串
 * @param {Uint8Array} array 要转换的 Uint8Array
 * @returns {string} 转换后的字符串
 */
export const uint8ArrayToString = (array: Uint8Array): string => {
  // 使用数组存储每个字符
  const chars: string[] = [];
  
  // 假设是 UTF-8 编码，一个字节一个字节地转换
  for (let i = 0; i < array.length; i++) {
    chars.push(String.fromCharCode(array[i]));
  }
  
  // 连接所有字符
  return chars.join('');
}
