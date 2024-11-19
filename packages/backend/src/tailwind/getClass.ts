// 定义节点信息接口
interface NodeInfo {
  id: string;
  type: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  opacity?: number;
  rotation?: number;
  strokes?: Array<{
    type: string;
    opacity?: number;
    color?: {
      r: number;
      g: number;
      b: number;
    };
  }>;
  strokeWeight?: number;
  fills?: Array<{
    type: string;
    opacity?: number;
    color?: {
      r: number;
      g: number;
      b: number;
    };
  }>;
  absoluteRenderBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  constraints?: {
    horizontal: string;
    vertical: string;
  };
  layoutAlign?: string;
  layoutGrow?: number;
}

/**
 * RGB颜色转换为HEX
 * @param r - 红色通道值 (0-1)
 * @param g - 绿色通道值 (0-1)
 * @param b - 蓝色通道值 (0-1)
 * @returns HEX颜色字符串
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * 获取布局约束相关的类
 * @param node - 节点信息
 * @returns 布局约束相关的类数组
 */
const getLayoutConstraints = (node: NodeInfo): string[] => {
  const styles: string[] = [];
  
  if (node.constraints) {
    // 水平约束
    switch (node.constraints.horizontal) {
      case 'MIN':
        styles.push('left-0');
        break;
      case 'MAX':
        styles.push('right-0');
        break;
      case 'CENTER':
        styles.push('mx-auto');
        break;
      case 'STRETCH':
        styles.push('w-full');
        break;
    }
    
    // 垂直约束
    switch (node.constraints.vertical) {
      case 'MIN':
        styles.push('top-0');
        break;
      case 'MAX':
        styles.push('bottom-0');
        break;
      case 'CENTER':
        styles.push('my-auto');
        break;
      case 'STRETCH':
        styles.push('h-full');
        break;
    }
  }

  // 布局对齐
  if (node.layoutAlign === 'STRETCH') {
    styles.push('w-full');
  }

  // 布局增长
  if (node.layoutGrow === 1) {
    styles.push('flex-grow');
  }

  return styles;
};

/**
 * 从节点信息中提取Tailwind CSS类
 * @param node - 节点信息对象
 * @returns Tailwind CSS类字符串
 */
export const getClass = (node: NodeInfo): string => {
  const styles: string[] = [];

  try {
    // 1. 尺寸
    if (node.width !== undefined && node.width > 0) {
      styles.push(`w-[${Math.round(node.width)}px]`);
    }
    if (node.height !== undefined && node.height > 0) {
      styles.push(`h-[${Math.round(node.height)}px]`);
    }

    // 2. 定位
    if (node.absoluteRenderBounds) {
      styles.push('absolute');
      styles.push(`left-[${Math.round(node.absoluteRenderBounds.x)}px]`);
      styles.push(`top-[${Math.round(node.absoluteRenderBounds.y)}px]`);
    } else if (node.x !== undefined && node.y !== undefined) {
      styles.push('absolute');
      styles.push(`left-[${Math.round(node.x)}px]`);
      styles.push(`top-[${Math.round(node.y)}px]`);
    }

    // 3. 旋转
    if (node.rotation && node.rotation !== 0) {
      styles.push(`rotate-[${Math.round(node.rotation)}deg]`);
    }

    // 4. 不透明度
    if (node.opacity !== undefined && node.opacity !== 1) {
      const opacityValue = Math.round(node.opacity * 100);
      styles.push(`opacity-${opacityValue}`);
    }

    // 5. 描边
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.color) {
        const strokeColor = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
        const strokeOpacity = stroke.opacity !== undefined ? Math.round(stroke.opacity * 100) : 100;
        styles.push(`border-[${strokeColor}]`);
        if (strokeOpacity !== 100) {
          styles.push(`border-opacity-${strokeOpacity}`);
        }
      }
      if (node.strokeWeight) {
        styles.push(`border-[${node.strokeWeight}px]`);
      }
    }

    // 6. 填充
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.color) {
        const backgroundColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        const fillOpacity = fill.opacity !== undefined ? Math.round(fill.opacity * 100) : 100;
        styles.push(`bg-[${backgroundColor}]`);
        if (fillOpacity !== 100) {
          styles.push(`bg-opacity-${fillOpacity}`);
        }
      }
    }

    // 7. 布局约束
    styles.push(...getLayoutConstraints(node));

    // 8. 特殊类型处理
    if (node.type === 'VECTOR') {
      styles.push('vector');
    }

  } catch (error) {
    console.error('提取样式时出错:', error, node);
  }

  // 过滤掉空值并组合成类字符串
  return styles.filter(Boolean).join(' ');
};

// 导出接口以供其他文件使用
export type { NodeInfo }; 