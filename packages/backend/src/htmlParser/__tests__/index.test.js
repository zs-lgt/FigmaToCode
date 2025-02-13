import { parseHtml, convertDocumentToFigma } from '../../packages/backend/src/htmlParser/index';

describe('HTML Parser', () => {
  describe('parseHtml', () => {
    it('should parse basic HTML', () => {
      const html = '<div class="container">Hello</div>';
      const doc = parseHtml(html);
      expect(doc).toBeDefined();
      expect(doc?.children[0].type).toBe('tag');
      expect((doc?.children[0]).name).toBe('div');
    });

    it('should handle empty HTML', () => {
      const html = '';
      const doc = parseHtml(html);
      expect(doc).toBeDefined();
      expect(doc?.children.length).toBe(0);
    });
  });

  describe('convertDocumentToFigma', () => {
    it('should convert basic div to frame', () => {
      const html = '<div class="flex items-center justify-center p-4">Hello</div>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'FRAME',
        name: 'div',
        layoutMode: 'HORIZONTAL',
        counterAxisAlignItems: 'CENTER',
        primaryAxisAlignItems: 'CENTER',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 16,
        paddingBottom: 16,
      });
    });

    it('should convert text elements with tailwind classes', () => {
      const html = '<p class="text-lg text-center">Hello World</p>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'TEXT',
        name: 'p',
        characters: 'Hello World',
        fontSize: 18,
        textAlignHorizontal: 'CENTER',
        fontName: { family: 'Inter', style: 'Regular' },
      });
    });

    it('should handle flex column layout', () => {
      const html = '<div class="flex-col gap-4">Content</div>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'FRAME',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
      });
    });

    it('should handle padding variations', () => {
      const html = '<div class="px-4 py-2">Content</div>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'FRAME',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
      });
    });

    it('should throw error for empty document', () => {
      const html = '';
      const doc = parseHtml(html);
      
      expect(() => {
        convertDocumentToFigma(doc);
      }).toThrow('No root element found in HTML document');
    });

    it('should handle heading elements', () => {
      const html = '<h1 class="text-2xl">Title</h1>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'TEXT',
        name: 'h1',
        characters: 'Title',
        fontSize: 24,
      });
    });

    it('should handle multiple text alignment classes', () => {
      const html = '<p class="text-left text-lg">Left aligned</p>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'TEXT',
        textAlignHorizontal: 'LEFT',
        fontSize: 18,
      });
    });

    it('should handle justify-between with gap', () => {
      const html = '<div class="flex justify-between gap-2">Content</div>';
      const doc = parseHtml(html);
      const figmaNode = convertDocumentToFigma(doc);

      expect(figmaNode).toMatchObject({
        type: 'FRAME',
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        itemSpacing: 8,
      });
    });
  });
});
