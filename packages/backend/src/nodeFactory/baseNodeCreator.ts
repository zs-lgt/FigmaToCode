// Types for node creation
export interface NodeCreator {
  createNode(data: any): Promise<SceneNode | null>;
  setBaseProperties(node: SceneNode, data: any): void;
  setGeometry(node: SceneNode, data: any, parentBounds?: { x: number, y: number }): { x: number, y: number };
  setAppearance(node: SceneNode, data: any): void;
}

// Base node creator with common functionality
export class BaseNodeCreator implements NodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    return null;
  }

  setBaseProperties(node: SceneNode, data: any) {
    if (data.name) node.name = data.name;
    if (data.visible !== undefined) node.visible = data.visible;
    if (data.locked !== undefined) node.locked = data.locked;
    if ('opacity' in node && data.opacity !== undefined) {
      (node as any).opacity = data.opacity;
    }
    
    // 设置constrainProportions属性
    if ('constrainProportions' in node && data.constrainProportions !== undefined) {
      // 检查节点类型是否支持constrainProportions
      if (node.type === 'RECTANGLE' || 
          node.type === 'ELLIPSE' || 
          node.type === 'POLYGON' || 
          node.type === 'STAR' || 
          node.type === 'VECTOR' || 
          node.type === 'LINE' || 
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'INSTANCE' ||
          node.type === 'BOOLEAN_OPERATION') {
        (node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | VectorNode | LineNode | BooleanOperationNode).constrainProportions = data.constrainProportions;
      }
    }
    
    // Set layout mode first - this is critical for parent nodes
    if ('layoutMode' in node && data.layoutMode) {
      node.layoutMode = data.layoutMode;
    }

    // Set layout align for child nodes
    if ('layoutAlign' in node && data.layoutAlign) {
      node.layoutAlign = data.layoutAlign;
    }

    // Check if node supports layout sizing and either has layoutMode or parent has layoutMode
    if ('layoutSizingHorizontal' in node && 'layoutSizingVertical' in node) {
      const parent = node.parent;
      
      // 检查父节点是否支持自动布局
      const isParentAutoLayout = parent && (
        parent.type === 'FRAME' || 
        parent.type === 'COMPONENT' || 
        parent.type === 'INSTANCE'
      ) && 'layoutMode' in parent;

      // 检查当前节点是否支持自动布局
      const isNodeAutoLayout = 'layoutMode' in node && node.layoutMode;
      
      // 如果父节点支持自动布局，强制设置其 layoutMode
      if (isParentAutoLayout && !parent.layoutMode && data.parentLayoutMode) {
        (parent as FrameNode).layoutMode = data.parentLayoutMode;
      }

      const hasAutoLayout = isNodeAutoLayout || (isParentAutoLayout && parent.layoutMode);
      
      if (hasAutoLayout && node.type !== 'FRAME') {
        if (data.layoutSizingHorizontal) {
          node.layoutSizingHorizontal = data.layoutSizingHorizontal;
        }
        if (data.layoutSizingVertical) {
          node.layoutSizingVertical = data.layoutSizingVertical;
        }
      }
    }
  }

  setGeometry(node: SceneNode, data: any, parentBounds?: { x: number, y: number }): { x: number, y: number } {
    let width = 100;
    let height = 100;
    let x = 0;
    let y = 0;

    // Get size from data, respecting layoutSizing
    if (data.layoutSizingHorizontal === 'HUG') {
      // Don't set width for HUG
      width = node.width;
    } else {
      width = Math.max(1, Math.abs(data.width || data.size?.width || width));
    }

    if (data.layoutSizingVertical === 'HUG') {
      // Don't set height for HUG
      height = node.height;
    } else {
      height = Math.max(1, Math.abs(data.height || data.size?.height || height));
    }

    // For INSTANCE nodes and their children, always use their own x,y coordinates
    if (data.type === 'INSTANCE' || (parentBounds && data.id?.includes(';'))) {
      x = data.x ?? 0;
      y = data.y ?? 0;
    } else if (data.absoluteBoundingBox) {
      x = data.absoluteBoundingBox.x || 0;
      y = data.absoluteBoundingBox.y || 0;
    } else if (data.relativeTransform) {
      x = data.relativeTransform[0][2];
      y = data.relativeTransform[1][2];
    }

    // Apply size if supported and not HUG
    if ('resize' in node) {
      try {
        // Only resize if either dimension is not HUG
        if (data.layoutSizingHorizontal !== 'HUG' || data.layoutSizingVertical !== 'HUG' || 
            (node.type !== 'FRAME' && node.type !== 'TEXT')) {
          node.resize(width, height);
        }
      } catch (error) {
        console.warn(`Failed to resize ${node.name}:`, error);
      }
    }

    // For INSTANCE nodes and their children, always use their own x,y as relative position
    let relativeX = x;
    let relativeY = y;
    
    if (parentBounds) {
      if (data.type === 'INSTANCE' || data.id?.includes(';')) {
        // For INSTANCE nodes and their children, always use their own x,y properties directly
        relativeX = data.x ?? 0;
        relativeY = data.y ?? 0;
      } else {
        // For other nodes, calculate relative position from absolute coordinates
        relativeX = x - parentBounds.x;
        relativeY = y - parentBounds.y;
      }
    }

    // Apply position if supported
    if ('x' in node) node.x = relativeX;
    if ('y' in node) node.y = relativeY;

    // Apply rotation if available
    if ('rotation' in node && data.rotation !== undefined) {
      node.rotation = data.rotation;
    }

    // For child positioning, return the actual coordinates used
    return { x: relativeX + (parentBounds?.x ?? 0), y: relativeY + (parentBounds?.y ?? 0) };
  }

  setAppearance(node: SceneNode, data: any) {
    // Set fills
    if ('fills' in node && data.fills) {
      try {
        node.fills = this.processFills(data.fills);
      } catch (error) {
        console.warn(`Failed to set fills for ${node.name}:`, error);
      }
    }

    // Set strokes
    if ('strokes' in node && data.strokes) {
      try {
        node.strokes = this.processStrokes(data.strokes);
        
        // Set stroke properties if available
        if ('strokeWeight' in node && data.strokeWeight !== undefined) {
          node.strokeWeight = data.strokeWeight;
        }
        if ('strokeAlign' in node && data.strokeAlign) {
          node.strokeAlign = data.strokeAlign;
        }
        if ('strokeCap' in node && data.strokeCap) {
          node.strokeCap = data.strokeCap;
        }
        if ('strokeJoin' in node && data.strokeJoin) {
          node.strokeJoin = data.strokeJoin;
        }
        if ('dashPattern' in node && data.strokeDashes) {
          node.dashPattern = data.strokeDashes;
        }
      } catch (error) {
        console.warn(`Failed to set strokes for ${node.name}:`, error);
      }
    }

    // Set effects (shadows, blurs, etc.)
    if ('effects' in node && data.effects) {
      try {
        node.effects = this.processEffects(data.effects);
      } catch (error) {
        console.warn(`Failed to set effects for ${node.name}:`, error);
      }
    }

    // Set blend mode
    if ('blendMode' in node && data.blendMode) {
      try {
        node.blendMode = data.blendMode;
      } catch (error) {
        console.warn(`Failed to set blend mode for ${node.name}:`, error);
      }
    }

    // Set opacity
    if ('opacity' in node && data.opacity !== undefined) {
      node.opacity = data.opacity;
    }

    // Set corner radius for shapes that support it
    if ('cornerRadius' in node) {
      try {
        if (data.cornerRadius !== undefined) {
          (node as any).cornerRadius = data.cornerRadius;
        } else if (data.topLeftRadius !== undefined && 
                   'topLeftRadius' in node &&
                   'topRightRadius' in node &&
                   'bottomLeftRadius' in node &&
                   'bottomRightRadius' in node) {
          // Handle individual corner radii
          (node as any).topLeftRadius = data.topLeftRadius;
          (node as any).topRightRadius = data.topRightRadius;
          (node as any).bottomLeftRadius = data.bottomLeftRadius;
          (node as any).bottomRightRadius = data.bottomRightRadius;
        }
      } catch (error) {
        console.warn(`Failed to set corner radius for ${node.name}:`, error);
      }
    }
  }

  protected processFills(fills: any[]): Paint[] {
    return fills.map(fill => {
      switch (fill.type) {
        case 'SOLID':
          return {
            type: 'SOLID',
            visible: fill.visible !== undefined ? fill.visible : true,
            color: {
              r: fill.color.r || 0,
              g: fill.color.g || 0,
              b: fill.color.b || 0
            },
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
            blendMode: fill.blendMode || 'NORMAL'
          };

        case 'GRADIENT_LINEAR':
        case 'GRADIENT_RADIAL':
        case 'GRADIENT_ANGULAR':
        case 'GRADIENT_DIAMOND':
          return {
            type: fill.type,
            visible: fill.visible !== undefined ? fill.visible : true,
            gradientStops: fill.gradientStops.map((stop: any) => ({
              color: {
                r: stop.color.r || 0,
                g: stop.color.g || 0,
                b: stop.color.b || 0,
                a: stop.color.a || 1
              },
              position: stop.position
            })),
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
            blendMode: fill.blendMode || 'NORMAL',
            gradientTransform: fill.gradientTransform || [[1, 0, 0], [0, 1, 0]]
          };

        case 'IMAGE':
          // 如果有base64图片数据，先创建图片，再返回填充
          if (fill.imageBase64) {
            try {
              // 从base64创建图片
              const imageData = fill.imageBase64;
              // 解析mime类型和数据部分
              const matches = imageData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
              
              if (matches && matches.length === 3) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                
                // 解码base64
                const imageBytes = figma.base64Decode(base64Data);
                
                // 创建新图片
                const image = figma.createImage(imageBytes);
                
                // 返回使用新创建图片的填充
                return {
                  type: 'IMAGE',
                  visible: fill.visible !== undefined ? fill.visible : true,
                  imageHash: image.hash,
                  scaleMode: fill.scaleMode || 'FILL',
                  opacity: fill.opacity !== undefined ? fill.opacity : 1,
                  blendMode: fill.blendMode || 'NORMAL',
                  imageTransform: fill.imageTransform || [[1, 0, 0], [0, 1, 0]]
                };
              }
            } catch (error) {
              console.warn('Failed to create image from base64:', error);
              // 如果失败，尝试使用原始imageHash
            }
          }
          
          // 使用原始imageHash（如果base64处理失败或没有base64数据）
          return {
            type: 'IMAGE',
            visible: fill.visible !== undefined ? fill.visible : true,
            imageHash: fill.imageHash || '',
            scaleMode: fill.scaleMode || 'FILL',
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
            blendMode: fill.blendMode || 'NORMAL',
            imageTransform: fill.imageTransform || [[1, 0, 0], [0, 1, 0]]
          };

        default:
          console.warn(`Unknown fill type: ${fill.type}`);
          return fill;
      }
    });
  }

  private processStrokes(strokes: any[]): Paint[] {
    return strokes.map(stroke => {
      switch (stroke.type) {
        case 'SOLID':
          return {
            type: 'SOLID',
            color: {
              r: stroke.color.r || 0,
              g: stroke.color.g || 0,
              b: stroke.color.b || 0
            },
            opacity: stroke.opacity !== undefined ? stroke.opacity : 1,
            blendMode: stroke.blendMode || 'NORMAL'
          };

        case 'GRADIENT_LINEAR':
        case 'GRADIENT_RADIAL':
        case 'GRADIENT_ANGULAR':
        case 'GRADIENT_DIAMOND':
          return {
            type: stroke.type,
            gradientStops: stroke.gradientStops.map((stop: any) => ({
              color: {
                r: stop.color.r || 0,
                g: stop.color.g || 0,
                b: stop.color.b || 0,
                a: stop.color.a || 1
              },
              position: stop.position
            })),
            opacity: stroke.opacity !== undefined ? stroke.opacity : 1,
            blendMode: stroke.blendMode || 'NORMAL',
            gradientTransform: stroke.gradientTransform || [[1, 0, 0], [0, 1, 0]]
          };

        default:
          console.warn(`Unknown stroke type: ${stroke.type}`);
          return stroke;
      }
    });
  }

  private processEffects(effects: any[]): Effect[] {
    return effects.map(effect => {
      switch (effect.type) {
        case 'DROP_SHADOW':
        case 'INNER_SHADOW':
          return {
            type: effect.type,
            color: {
              r: effect.color.r || 0,
              g: effect.color.g || 0,
              b: effect.color.b || 0,
              a: effect.color.a || 1
            },
            offset: {
              x: effect.offset.x || 0,
              y: effect.offset.y || 0
            },
            radius: effect.radius || 0,
            spread: effect.spread || 0,
            visible: effect.visible !== undefined ? effect.visible : true,
            blendMode: effect.blendMode || 'NORMAL'
          };

        case 'LAYER_BLUR':
        case 'BACKGROUND_BLUR':
          return {
            type: effect.type,
            radius: effect.radius || 0,
            visible: effect.visible !== undefined ? effect.visible : true
          };

        default:
          console.warn(`Unknown effect type: ${effect.type}`);
          return effect;
      }
    });
  }
}