import { createFigma } from 'figma-api-stub';
import { text } from '../text';
import { DEFAULT_FONT } from '../../helpers/constants';

describe('text renderer', () => {
    beforeEach(() => {
        // @ts-ignore
        global.figma = createFigma({
            simulateErrors: true
        });
    });

    // * Motivation *
    // Without setup textAutoResize text can unexpectedly wrap to the next line
    // --------------
    it('textAutoResize: WIDTH_AND_HEIGHT by default', async () => {
        await figma.loadFontAsync(DEFAULT_FONT);
        const textNode = text(null)({ loadedFont: DEFAULT_FONT });
        expect(textNode.textAutoResize).toEqual('WIDTH_AND_HEIGHT');
    });

    it('textAutoResize prop supported overrides default', async () => {
        await figma.loadFontAsync(DEFAULT_FONT);
        const textNode = text(null)({ textAutoResize: 'HEIGHT', loadedFont: DEFAULT_FONT });
        expect(textNode.textAutoResize).toEqual('HEIGHT');
    });

    it('textAutoResize: HEIGHT when hasDefinedWidth is true', async () => {
        await figma.loadFontAsync(DEFAULT_FONT);
        const node = figma.createText();
        // @ts-ignore
        node.height = 20;
        const textNode = text(node)({
            width: 200,
            loadedFont: DEFAULT_FONT,
            hasDefinedWidth: true
        });
        expect(textNode.textAutoResize).toEqual('HEIGHT');
    });

    it('text render prefer to use loaded font', async () => {
        await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
        const node = figma.createText();
        const textNode = text(node)({
            fontName: { family: 'Inter', style: 'SemiBold' },
            loadedFont: { family: 'Inter', style: 'Semi Bold' }
        });
        expect(textNode.fontName.style).toEqual('Semi Bold');
    });
});
