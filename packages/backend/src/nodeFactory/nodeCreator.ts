import { BaseNodeCreator } from "./baseNodeCreator";
// 导入字体缓存和替换函数
import { loadedFonts, getFallbackFont } from '../importFigma';

// 验证数据类型
const validateType = (data: any, type: string) => {
  return typeof data === type;
}

// 文本节点
export class TextNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createText();
    this.setBaseProperties(node, data);
    
    try {
      // 3. 写入文本（现在可以安全地写入，因为字体已在预加载阶段加载）
      if (data.characters) {
        node.characters = data.characters;
      }
      
      // 4. 导入文本样式
      await this.applyTextStyles(node, data);
      
      // 5. 导入背景、边框等容器样式
      this.setAppearance(node, data);
      
      return node;
    } catch (error) {
      console.error('Error creating text node:', error);
      return node;
    }
  }

  private async loadFont(data: any): Promise<FontName> {
    try {
      let fontName: FontName;

      // Try to get font from style or direct properties
      if (data.style?.fontName) {
        fontName = data.style.fontName;
      } else if (data.fontName) {
        fontName = data.fontName;
      } else {
        // Default font
        fontName = { family: "Inter", style: "Regular" };
      }

      // 检查字体是否已加载
      const fontKey = `${fontName.family}:${fontName.style}`;
      if (loadedFonts.has(fontKey)) {
        return fontName;
      }

      // 如果字体未加载，尝试获取替代字体
      const fallback = getFallbackFont(fontName.family, fontName.style);
      const fallbackKey = `${fallback.family}:${fallback.style}`;
      
      // 如果替代字体也未加载，加载它
      if (!loadedFonts.has(fallbackKey)) {
        await figma.loadFontAsync(fallback);
        loadedFonts.add(fallbackKey);
      }
      
      return fallback;
    } catch (error) {
      console.warn('Font loading error, falling back to Inter:', error);
      const fallbackFont = { family: "Inter", style: "Regular" };
      // 检查默认字体是否已加载
      if (!loadedFonts.has('Inter:Regular')) {
        await figma.loadFontAsync(fallbackFont);
        loadedFonts.add('Inter:Regular');
      }
      return fallbackFont;
    }
  }

  async applyTextStyles(node: TextNode, data: any) {
    try {
      // Get style object combining direct properties and style object
      const style = { ...data.style, ...data };

      // Load and set font first
      if (style.fontName) {
        const loadedFont = await this.loadFont({ fontName: style.fontName });
        node.fontName = loadedFont;
      }

      // Set text auto resize first to ensure proper width calculation
      if (style.textAutoResize) {
        node.textAutoResize = style.textAutoResize;
      } else {
        // Default to WIDTH_AND_HEIGHT for title-like text
        node.textAutoResize = "WIDTH_AND_HEIGHT";
      }

      // Apply text segments if available
      if (style.textSegments && Array.isArray(style.textSegments)) {
        try {
          // Clear existing text
          node.characters = '';
          
          // Apply segments
          for (const segment of style.textSegments) {
            const start = node.characters.length;
            
            // Load font before applying text
            if (segment.fontName) {
              const loadedFont = await this.loadFont({ fontName: segment.fontName });
              segment.fontName = loadedFont;
            }
            
            // Insert text
            node.insertCharacters(start, segment.characters);
            
            // Apply segment-specific styles
            if (segment.fontSize) {
              node.setRangeFontSize(start, start + segment.characters.length, segment.fontSize);
            }
            if (segment.fontName) {
              node.setRangeFontName(start, start + segment.characters.length, segment.fontName);
            }
            if (segment.fills) {
              node.setRangeFills(start, start + segment.characters.length, this.processFills(segment.fills));
            }
            if (segment.textDecoration) {
              node.setRangeTextDecoration(start, start + segment.characters.length, segment.textDecoration);
            }
            if (segment.letterSpacing) {
              node.setRangeLetterSpacing(start, start + segment.characters.length, segment.letterSpacing);
            }
            if (segment.lineHeight) {
              node.setRangeLineHeight(start, start + segment.characters.length, segment.lineHeight);
            }
            if (segment.textCase) {
              node.setRangeTextCase(start, start + segment.characters.length, segment.textCase);
            }
          }
        } catch (error) {
          console.warn('Failed to apply text segments:', error);
          // Fallback to simple text
          node.characters = data.characters || '';
        }
      }

      // Apply other text styles
      if (style.fontSize) node.fontSize = style.fontSize;
      if (style.textAlignHorizontal) node.textAlignHorizontal = style.textAlignHorizontal;
      if (style.textAlignVertical) node.textAlignVertical = style.textAlignVertical;
      if (style.textCase) node.textCase = style.textCase;
      if (style.textDecoration) node.textDecoration = style.textDecoration;
      if (style.letterSpacing) node.letterSpacing = style.letterSpacing;
      if (style.lineHeight) node.lineHeight = style.lineHeight;
      if (style.paragraphIndent) node.paragraphIndent = style.paragraphIndent;
      if (style.paragraphSpacing) node.paragraphSpacing = style.paragraphSpacing;

      // Ensure constraints are set for auto-width
      if (node.textAutoResize === "WIDTH_AND_HEIGHT") {
        node.constraints = {
          horizontal: "MIN",
          vertical: "MIN"
        };
      }

    } catch (error) {
      console.error('Error applying text styles:', error);
    }
  }
}

// Document node creator
export class DocumentNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createFrame();
    this.setBaseProperties(node, data);
    
    // Document should not have fills
    node.fills = [];
    
    // Set a large size initially - will be adjusted based on children
    node.resize(3000, 2000);
    
    return node;
  }
}

// Canvas node creator
export class CanvasNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createFrame();
    this.setBaseProperties(node, data);
    
    // Canvas should not have fills
    node.fills = [];
    node.layoutMode = "NONE";
    
    return node;
  }
}

// Frame node creator
export class FrameNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createFrame();
    
    // Set base properties
    this.setBaseProperties(node, data);
    
    // Set layout properties
    if (data.layoutMode) {
      node.layoutMode = data.layoutMode;
      if (data.primaryAxisSizingMode && validateType(data.primaryAxisSizingMode, 'string')) node.primaryAxisSizingMode = data.primaryAxisSizingMode;
      if (data.counterAxisSizingMode && validateType(data.counterAxisSizingMode, 'string')) node.counterAxisSizingMode = data.counterAxisSizingMode;
      if (data.primaryAxisAlignItems && validateType(data.primaryAxisAlignItems, 'string')) node.primaryAxisAlignItems = data.primaryAxisAlignItems;
      if (data.counterAxisAlignItems && validateType(data.counterAxisAlignItems, 'string')) node.counterAxisAlignItems = data.counterAxisAlignItems;
      if (data.layoutWrap !== undefined && validateType(data.layoutWrap, 'boolean')) node.layoutWrap = data.layoutWrap;
      if (data.itemSpacing !== undefined && validateType(data.itemSpacing, 'number')) node.itemSpacing = data.itemSpacing;
    }

    // Set padding
    if (data.paddingLeft !== undefined && validateType(data.paddingLeft, 'number')) node.paddingLeft = data.paddingLeft;
    if (data.paddingRight !== undefined && validateType(data.paddingRight, 'number')) node.paddingRight = data.paddingRight;
    if (data.paddingTop !== undefined && validateType(data.paddingTop, 'number')) node.paddingTop = data.paddingTop;
    if (data.paddingBottom !== undefined && validateType(data.paddingBottom, 'number')) node.paddingBottom = data.paddingBottom;

    // Set clipsContent
    if (data.clipsContent !== undefined && validateType(data.clipsContent, 'boolean')) node.clipsContent = data.clipsContent;

    // Set appearance
    this.setAppearance(node, data);
    
    // 通过节点ID获取节点信息并设置layoutSizing属性
    try {
      if (data.layoutSizingHorizontal || data.layoutSizingVertical) {
        // 确保节点已经被添加到文档中
        if (node.parent) {
          const nodeInfo = figma.getNodeById(node.id);
          if (nodeInfo && nodeInfo.type === 'FRAME') {
            
            if (data.layoutSizingHorizontal) {
              nodeInfo.layoutSizingHorizontal = data.layoutSizingHorizontal;
            }
            if (data.layoutSizingVertical) {
              nodeInfo.layoutSizingVertical = data.layoutSizingVertical;
            }
          }
        } else {
          console.warn(`[${node.name}] Node not in document yet, cannot set layoutSizing`);
        }
      }
    } catch (error) {
      console.warn(`[${node.name}] Error setting layoutSizing:`, error);
    }
    
    return node;
  }
}

// Rectangle node creator
export class RectangleNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createRectangle();
    this.setBaseProperties(node, data);
    
    // Set corner radius
    if (data.cornerRadius !== undefined) {
      node.cornerRadius = data.cornerRadius;
    }
    
    this.setAppearance(node, data);
    return node;
  }
}

// Group node creator
export class GroupNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    // Figma API不允许直接创建Group，只能先创建Frame，然后在子节点添加后转换为Group
    const node = figma.createFrame();
    
    this.setBaseProperties(node, data);
    
    // Groups don't have fills
    node.fills = [];
    
    return node;
  }
}

// Component node creator
export class ComponentNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createComponent();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Instance node creator
export class InstanceNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    // Since we can't create instances without main components,
    // create a frame as a placeholder
    const node = figma.createFrame();
    this.setBaseProperties(node, data);

    // 设置特殊的布局属性
    if (data.layoutMode) {
      node.layoutMode = data.layoutMode;
      if (data.primaryAxisSizingMode && validateType(data.primaryAxisSizingMode, 'string')) node.primaryAxisSizingMode = data.primaryAxisSizingMode;
      if (data.counterAxisSizingMode && validateType(data.counterAxisSizingMode, 'string')) node.counterAxisSizingMode = data.counterAxisSizingMode;
      if (data.primaryAxisAlignItems && validateType(data.primaryAxisAlignItems, 'string')) node.primaryAxisAlignItems = data.primaryAxisAlignItems;
      if (data.counterAxisAlignItems && validateType(data.counterAxisAlignItems, 'string')) node.counterAxisAlignItems = data.counterAxisAlignItems;
      if (data.layoutWrap !== undefined && validateType(data.layoutWrap, 'boolean')) node.layoutWrap = data.layoutWrap;
      if (data.paddingLeft !== undefined && validateType(data.paddingLeft, 'number')) node.paddingLeft = data.paddingLeft;
      if (data.paddingRight !== undefined && validateType(data.paddingRight, 'number')) node.paddingRight = data.paddingRight;
      if (data.paddingTop !== undefined && validateType(data.paddingTop, 'number')) node.paddingTop = data.paddingTop;
      if (data.paddingBottom !== undefined && validateType(data.paddingBottom, 'number')) node.paddingBottom = data.paddingBottom;
      if (data.itemSpacing !== undefined && validateType(data.itemSpacing, 'number')) node.itemSpacing = data.itemSpacing;
    }

    // 设置变换属性
    if (data.relativeTransform) {
      // 从变换矩阵中提取位置和旋转信息
      const [a, b, x] = data.relativeTransform[0];
      const [c, d, y] = data.relativeTransform[1];
      
      // 设置位置
      node.x = x;
      node.y = y;
      
      // 计算并设置旋转角度
      if (a !== 1 || b !== 0 || c !== 0 || d !== 1) {
        const rotation = Math.atan2(b, a) * (180 / Math.PI);
        node.rotation = rotation;
      }
    }

    this.setAppearance(node, data);
    return node;
  }
}

// Vector node creator
export class VectorNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createVector();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    
    // Try to get vector paths from different sources
    let vectorPaths = data.vectorPaths;
    
    // If no vectorPaths, try to create from strokeGeometry or fillGeometry
    if (!vectorPaths) {
      const geometries = [];
      if (data.strokeGeometry) geometries.push(...data.strokeGeometry);
      if (data.fillGeometry) geometries.push(...data.fillGeometry);
      
      if (geometries.length > 0) {
        vectorPaths = geometries.map((path: any) => ({
          windingRule: path.windingRule || "NONZERO",
          // Format path data to ensure proper spacing around negative numbers and commands
          data: path.data.replace(/([a-zA-Z])(-?\d)/g, '$1 $2').replace(/(\d)-/g, '$1 -')
        }));
      }
    } else {
      // Format existing vectorPaths data
      vectorPaths = vectorPaths.map((path: any) => ({
        windingRule: path.windingRule || "NONZERO",
        data: path.data.replace(/([a-zA-Z])(-?\d)/g, '$1 $2').replace(/(\d)-/g, '$1 -')
      }));
    }
    
    // Set vector paths if available
    if (vectorPaths && vectorPaths.length > 0) {
      try {
        node.vectorPaths = vectorPaths;
      } catch (error) {
        console.warn('Failed to set vector paths:', error);
        // Attempt to set paths individually if bulk set fails
        vectorPaths.forEach((path: any, index: number) => {
          try {
            node.vectorPaths = [path];
          } catch (innerError) {
            console.warn(`Failed to set vector path at index ${index}:`, innerError);
          }
        });
      }
    }
    
    return node;
  }
}

// Boolean operation node creator
export class BooleanOperationNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createBooleanOperation();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Ellipse node creator
export class EllipseNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createEllipse();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// SVG node creator
export class SVGNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    try {
      if (!data.svg) {
        console.warn('没有提供SVG内容');
        return null;
      }
      
      // 使用Figma的createNodeFromSvg API创建SVG节点
      const svgNode = figma.createNodeFromSvg(data.svg);
      
      // 设置基本属性
      this.setBaseProperties(svgNode, data);
      
      // 设置位置
      if (data.x !== undefined) svgNode.x = data.x;
      if (data.y !== undefined) svgNode.y = data.y;
      
      // 设置尺寸（如果有指定）
      if (data.width && data.height) {
        // 保持纵横比缩放
        const currentRatio = svgNode.width / svgNode.height;
        const targetRatio = data.width / data.height;
        
        if (Math.abs(currentRatio - targetRatio) < 0.1) {
          // 如果纵横比相近，直接调整大小
          svgNode.resize(data.width, data.height);
        } else {
          // 如果纵横比差异较大，保持纵横比缩放
          if (currentRatio > targetRatio) {
            // 宽度限制
            const newWidth = data.width;
            const newHeight = svgNode.height * (newWidth / svgNode.width);
            svgNode.resize(newWidth, newHeight);
          } else {
            // 高度限制
            const newHeight = data.height;
            const newWidth = svgNode.width * (newHeight / svgNode.height);
            svgNode.resize(newWidth, newHeight);
          }
        }
      }
      
      // 为节点添加SVG元数据
      svgNode.setPluginData('isSvgNode', 'true');
      svgNode.setPluginData('originalSvgContent', data.svg);
      
      return svgNode;
    } catch (error) {
      console.error('创建SVG节点时出错:', error);
      
      // 出错时回退到创建占位Frame
      try {
        const placeholderNode = figma.createFrame();
        placeholderNode.name = data.name || 'SVG占位符';
        this.setBaseProperties(placeholderNode, data);
        
        // 设置尺寸和位置
        if (data.width && data.height) {
          placeholderNode.resize(data.width, data.height);
        } else {
          placeholderNode.resize(100, 100);
        }
        
        if (data.x !== undefined) placeholderNode.x = data.x;
        if (data.y !== undefined) placeholderNode.y = data.y;
        
        // 添加错误提示
        const textNode = figma.createText();
        textNode.characters = 'SVG加载失败';
        textNode.fontSize = 12;
        textNode.x = 5;
        textNode.y = 5;
        placeholderNode.appendChild(textNode);
        
        return placeholderNode;
      } catch (fallbackError) {
        console.error('创建SVG占位节点也失败了:', fallbackError);
        return null;
      }
    }
  }
}