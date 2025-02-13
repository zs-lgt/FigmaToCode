
import { type Document, type Element } from "domhandler";
import * as HtmlParser from 'htmlparser2';

const TAILWIND_COLORS: { [key: string]: { r: number, g: number, b: number, a: number } } = {
  'black': { r: 0, g: 0, b: 0, a: 1 },
  'white': { r: 1, g: 1, b: 1, a: 1 },
  'gray-100': { r: 0.97, g: 0.97, b: 0.97, a: 1 },
  'gray-200': { r: 0.93, g: 0.93, b: 0.93, a: 1 },
  'gray-300': { r: 0.87, g: 0.87, b: 0.87, a: 1 },
  'gray-400': { r: 0.74, g: 0.74, b: 0.74, a: 1 },
  'gray-500': { r: 0.64, g: 0.64, b: 0.64, a: 1 },
  'gray-600': { r: 0.45, g: 0.45, b: 0.45, a: 1 },
  'gray-700': { r: 0.37, g: 0.37, b: 0.37, a: 1 },
  'gray-800': { r: 0.26, g: 0.26, b: 0.26, a: 1 },
  'gray-900': { r: 0.17, g: 0.17, b: 0.17, a: 1 },
  'blue-500': { r: 0.24, g: 0.47, b: 0.95, a: 1 },
  'green-500': { r: 0.24, g: 0.85, b: 0.44, a: 1 },
  'red-500': { r: 0.94, g: 0.2, b: 0.2, a: 1 },
};

const TAILWIND_FONT_SIZES: { [key: string]: number } = {
  'xs': 12,
  'sm': 14,
  'base': 16,
  'lg': 18,
  'xl': 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

const convertTailwindColorToFigma = (color: string): Paint | null => {
  if (TAILWIND_COLORS[color]) {
    return {
      type: 'SOLID',
      color: TAILWIND_COLORS[color],
    };
  }
  return null;
};
interface FigmaNodeProperties {
  type: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisAlignItems?: 'CENTER' | 'MIN' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'CENTER' | 'MIN' | 'MAX';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  characters?: string;
  fontSize?: number;
  fontName?: FontName;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
}

const cleanHtmlContent = (html: string): string => {
  return html
    .replace(/>[\s\n\r]+</g, '><') // Remove whitespace between tags
    .replace(/[\s\n\r]+/g, ' ') // Replace multiple spaces/newlines with single space
    .trim(); // Remove leading/trailing whitespace
};

const isEmptyTextNode = (node: any): boolean => {
  return node.type === 'text' && (!node.data || /^[\s\n\r]*$/.test(node.data));
};

const cleanNode = (node: any): void => {
  if (node.children) {
    // Filter out empty text nodes and clean remaining children
    node.children = node.children
      .filter((child: any) => !isEmptyTextNode(child))
      .map((child: any) => {
        cleanNode(child);
        return child;
      });
  }
};

export const parseHtml = (html: string): Document | undefined => {
  const cleanedHtml = cleanHtmlContent(html);
  const doc = HtmlParser.parseDocument(cleanedHtml);
  
  // Clean the document tree
  if (doc.children) {
    doc.children = doc.children
      .filter(child => !isEmptyTextNode(child))
      .map(child => {
        cleanNode(child);
        return child;
      });
  }
  
  return doc;
};

const convertTailwindClassesToFigmaProps = (classes: string[]): Partial<FigmaNodeProperties> => {
  const props: Partial<FigmaNodeProperties> = {};

  for (const cls of classes) {
    // Layout
    if (cls === 'flex') {
      props.layoutMode = 'HORIZONTAL';
    } else if (cls === 'flex-col') {
      props.layoutMode = 'VERTICAL';
    }
    
    // Alignment
    else if (cls === 'justify-center') {
      props.primaryAxisAlignItems = 'CENTER';
    } else if (cls === 'justify-start') {
      props.primaryAxisAlignItems = 'MIN';
    } else if (cls === 'justify-end') {
      props.primaryAxisAlignItems = 'MAX';
    } else if (cls === 'justify-between') {
      props.primaryAxisAlignItems = 'SPACE_BETWEEN';
    }
    
    // Cross-axis alignment
    else if (cls === 'items-center') {
      props.counterAxisAlignItems = 'CENTER';
    } else if (cls === 'items-start') {
      props.counterAxisAlignItems = 'MIN';
    } else if (cls === 'items-end') {
      props.counterAxisAlignItems = 'MAX';
    }
    
    // Padding
    else if (cls.startsWith('p-')) {
      const value = parseInt(cls.slice(2)) * 4;
      props.paddingLeft = value;
      props.paddingRight = value;
      props.paddingTop = value;
      props.paddingBottom = value;
    } else if (cls.startsWith('px-')) {
      const value = parseInt(cls.slice(3)) * 4;
      props.paddingLeft = value;
      props.paddingRight = value;
    } else if (cls.startsWith('py-')) {
      const value = parseInt(cls.slice(3)) * 4;
      props.paddingTop = value;
      props.paddingBottom = value;
    }
    
    // Gap
    else if (cls.startsWith('gap-')) {
      props.itemSpacing = parseInt(cls.slice(4)) * 4;
    }
    
    // Text alignment
    else if (cls === 'text-center') {
      props.textAlignHorizontal = 'CENTER';
    } else if (cls === 'text-left') {
      props.textAlignHorizontal = 'LEFT';
    } else if (cls === 'text-right') {
      props.textAlignHorizontal = 'RIGHT';
    } else if (cls === 'text-justify') {
      props.textAlignHorizontal = 'JUSTIFIED';
    }

    // height
    else if (cls.startsWith('h-')) {
      const value = cls.slice(2);
      if (value === 'full') {
        props.height = 800; // Default full height
      } else if (value === 'screen') {
        props.height = 900; // Default screen height
      } else if (value === 'auto') {
        props.height = 'AUTO'; // Auto height
      } else if (value.endsWith('px')) {
        props.height = parseInt(value);
      } else if (value.endsWith('%')) {
        // Convert percentage to pixels (assuming container width of 1000px)
        props.height = Math.floor(parseInt(value) * 10);
      } else {
        // Convert Tailwind's size scale to pixels
        const size = parseInt(value);
        if (!isNaN(size)) {
          props.height = size * 4; // Tailwind's 4px grid
        }
      }
    }

    // width
    else if (cls.startsWith('w-')) {
      const value = cls.slice(2);
      if (value === 'full') {
        props.width = 1000; // Default full width
      } else if (value === 'screen') {
        props.width = 1200; // Default screen width
      } else if (value === 'auto') {
        props.width = 'AUTO'; // Auto width
      } else if (value.endsWith('px')) {
        props.width = parseInt(value);
      } else if (value.endsWith('%')) {
        // Convert percentage to pixels (assuming container width of 1000px)
        props.width = Math.floor(parseInt(value) * 10);
      } else {
        // Convert Tailwind's size scale to pixels
        const size = parseInt(value);
        if (!isNaN(size)) {
          props.width = size * 4; // Tailwind's 4px grid
        }
      }
    }
    
    // Max/Min width
    else if (cls.startsWith('max-w-')) {
      const value = cls.slice(6);
      if (value === 'full') {
        props.maxWidth = 1000;
      } else if (value === 'screen-sm') {
        props.maxWidth = 640;
      } else if (value === 'screen-md') {
        props.maxWidth = 768;
      } else if (value === 'screen-lg') {
        props.maxWidth = 1024;
      } else if (value === 'screen-xl') {
        props.maxWidth = 1280;
      } else if (value === 'screen-2xl') {
        props.maxWidth = 1536;
      }
    }
    else if (cls.startsWith('min-w-')) {
      const value = cls.slice(6);
      if (value === 'full') {
        props.minWidth = 1000;
      } else {
        const size = parseInt(value);
        if (!isNaN(size)) {
          props.minWidth = size * 4;
        }
      }
    }
    
    // Max/Min height
    else if (cls.startsWith('max-h-')) {
      const value = cls.slice(6);
      if (value === 'full') {
        props.maxHeight = 800;
      } else if (value === 'screen') {
        props.maxHeight = 900;
      } else {
        const size = parseInt(value);
        if (!isNaN(size)) {
          props.maxHeight = size * 4;
        }
      }
    }
    else if (cls.startsWith('min-h-')) {
      const value = cls.slice(6);
      if (value === 'full') {
        props.minHeight = 800;
      } else if (value === 'screen') {
        props.minHeight = 900;
      } else {
        const size = parseInt(value);
        if (!isNaN(size)) {
          props.minHeight = size * 4;
        }
      }
    }
    
    // Background color
    else if (cls.startsWith('bg-')) {
      const color = cls.slice(3);
      const fill = convertTailwindColorToFigma(color);
      if (fill) {
        props.fills = [fill];
      }
    }

    // Text color
    else if (cls.startsWith('text-')) {
      const value = cls.slice(5);
      if (value in TAILWIND_FONT_SIZES) {
        props.fontSize = TAILWIND_FONT_SIZES[value];
      } else {
        const fill = convertTailwindColorToFigma(value);
        if (fill) {
          props.fills = [fill];
        }
      }
    }

    // Border
    else if (cls.startsWith('border')) {
      if (cls === 'border') {
        props.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }];
        props.strokeWeight = 1;
      } else if (cls.startsWith('border-')) {
        const value = cls.slice(7);
        if (!isNaN(parseInt(value))) {
          props.strokeWeight = parseInt(value);
        } else {
          const fill = convertTailwindColorToFigma(value);
          if (fill) {
            props.strokes = [fill];
          }
        }
      }
    }

    // Border radius
    else if (cls.startsWith('rounded')) {
      if (cls === 'rounded') {
        props.cornerRadius = 4;
      } else if (cls === 'rounded-full') {
        props.cornerRadius = 9999;
      } else if (cls.startsWith('rounded-')) {
        const value = cls.slice(8);
        const sizes: { [key: string]: number } = {
          'sm': 2,
          'md': 6,
          'lg': 8,
          'xl': 12,
          '2xl': 16,
          '3xl': 24,
        };
        if (sizes[value]) {
          props.cornerRadius = sizes[value];
        } else {
          const size = parseInt(value);
          if (!isNaN(size)) {
            props.cornerRadius = size * 4;
          }
        }
      }
    }

    // Opacity
    else if (cls.startsWith('opacity-')) {
      const value = parseInt(cls.slice(8));
      if (!isNaN(value)) {
        if (props.fills && props.fills.length > 0) {
          props.fills = props.fills.map(fill => ({
            ...fill,
            opacity: value / 100
          }));
        }
      }
    }

    // Shadow
    else if (cls.startsWith('shadow')) {
      const shadows: { [key: string]: Effect } = {
        'shadow-sm': {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.05 },
          offset: { x: 0, y: 1 },
          radius: 2,
          visible: true,
          blendMode: 'NORMAL'
        },
        'shadow': {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 2 },
          radius: 4,
          visible: true,
          blendMode: 'NORMAL'
        },
        'shadow-md': {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 4 },
          radius: 6,
          visible: true,
          blendMode: 'NORMAL'
        },
        'shadow-lg': {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 8 },
          radius: 10,
          visible: true,
          blendMode: 'NORMAL'
        },
      };
      if (shadows[cls]) {
        props.effects = [shadows[cls]];
      }
    }
  }

  return props;
};

const convertElementToFigma = (element: Element): SceneNode => {
  const name = element.attribs['data-node-name']
  const type = element.attribs['data-node-type']
  const classes = (element.attribs?.class || '').split(' ').filter(Boolean);
  const figmaProps = convertTailwindClassesToFigmaProps(classes);
  let children: SceneNode[] = [];

  if (element.children) {
    children = element.children.map(child => {
      if (child.type === 'tag') {
        return convertElementToFigma(child);
      }
      return null;
    }).filter(child => child !== null) as SceneNode[];
  }

  // Handle text elements
  if (element.tagName === 'p' || element.tagName === 'span' || element.tagName === 'h1' || 
      element.tagName === 'h2' || element.tagName === 'h3' || element.tagName === 'h4' || 
      element.tagName === 'h5' || element.tagName === 'h6' || element.children
      .filter(child => child.type === 'text' && child.data && child.data.trim().length > 0)) {

    const textContent = element.children
      .filter(child => child.type === 'text' && child.data && child.data.trim().length > 0)
      .map(child => (child as any).data.trim())
      .join(' ');

    if (textContent) {
      const textNode: Partial<TextNode> = {
        type: 'TEXT',
        name: name || element.tagName || 'Text',
        characters: textContent,
        fontSize: figmaProps.fontSize || 16,
        fontName: figmaProps.fontName || { family: 'Inter', style: 'Regular' },
        ...figmaProps
      };
      return textNode as TextNode;
    }
  }

  // Create frame node
  const frameNode: Partial<FrameNode> = {
    type: 'FRAME',
    name: name || element.tagName || 'Frame',
    children: children,
    ...figmaProps
  };

  // Set default layout properties if not specified
  if (!frameNode.layoutMode) {
    frameNode.layoutMode = 'VERTICAL';
    frameNode.primaryAxisSizingMode = 'AUTO';
    frameNode.counterAxisSizingMode = 'AUTO';
    frameNode.primaryAxisAlignItems = 'MIN';
    frameNode.counterAxisAlignItems = 'MIN';
  }


  return frameNode as FrameNode;
};

export const convertDocumentToFigma = (document: Document): SceneNode => {
  // Find the root element
  const rootElement = document.children.find(
    child => child.type === 'tag'
  ) as Element;

  if (!rootElement) {
    throw new Error('No root element found in HTML document');
  }
  console.log('rootElement', rootElement);
  return convertElementToFigma(rootElement);
};