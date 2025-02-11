import { baseNodeMixin } from '../mixins/baseNodeMixin';
import { geometryMixin } from '../mixins/geometryMixin';
import { layoutMixin } from '../mixins/layoutMixin';
import { saveStyleMixin } from '../mixins/saveStyleMixin';
import { propsAssign } from '../helpers/propsAssign';
import { exportMixin } from '../mixins/exportMixin';
import { TextProps } from '../components/text/Text';
import { blendMixin } from '../mixins/blendMixin';
import { isValidSize } from '../helpers/isValidSize';
import { isEqualFontStyle } from '../helpers/isEqualFontStyle';
import { sceneNodeMixin } from '../mixins/sceneNodeMixin';
import { uiApi } from '../rpc';
import { safeGetPluginData } from '../helpers/safeGetPluginData';
import { constraintsMixin } from '../mixins/constraintsMixin';
import { DEFAULT_FONT } from '../helpers/constants';

const textNodePropsAssign = propsAssign<TextProps, TextProps>(
    [
        'characters',
        'textAlignHorizontal',
        'textAlignVertical',
        'paragraphIndent',
        'paragraphSpacing',
        'autoRename',
        'fontSize',
        'textCase',
        'textDecoration',
        'letterSpacing',
        'lineHeight',
        'textStyleId',
        'hyperlink'
    ],
    {
        characters: '',
        textAlignHorizontal: 'LEFT',
        textAlignVertical: 'TOP',
        paragraphIndent: 0,
        paragraphSpacing: 0,
        autoRename: false,
        fontSize: 12,
        textCase: 'ORIGINAL',
        textDecoration: 'NONE',
        letterSpacing: { value: 0, unit: 'PIXELS' },
        lineHeight: { unit: 'AUTO' },
        hyperlink: null
    }
);

const defaultFont = DEFAULT_FONT;

export const text = (node: TextNode) => (props: TextProps & { loadedFont?: FontName; hasDefinedWidth?: boolean }) => {
    const textNode = node || props.node || figma.createText();

    baseNodeMixin(textNode)(props);
    saveStyleMixin(textNode)(props);
    layoutMixin(textNode)(props);
    geometryMixin(textNode)(props);
    exportMixin(textNode)(props);
    blendMixin(textNode)(props);
    sceneNodeMixin(textNode)(props);
    constraintsMixin(textNode)(props);

    const { loadedFont, fontName = defaultFont } = props;
    if (
        loadedFont &&
        fontName &&
        loadedFont.family === fontName.family &&
        isEqualFontStyle(loadedFont.style, fontName.style)
    ) {
        if (props.fontName) {
            textNode.fontName = loadedFont;
        }
        if (
            props.hasDefinedWidth &&
            isValidSize(props.width) &&
            isValidSize(textNode.height) &&
            !props.textAutoResize
        ) {
            textNode.resize(props.width, textNode.height);
            textNode.textAutoResize = 'HEIGHT';
        } else {
            textNode.textAutoResize = props.textAutoResize || 'WIDTH_AND_HEIGHT';
        }

        const oldCharacters = textNode.characters;
        const oldFontSize = textNode.fontSize;
        textNodePropsAssign(textNode)(props);
        if (oldCharacters !== textNode.characters || oldFontSize !== textNode.fontSize) {
            const reactId = safeGetPluginData('reactId')(textNode);
            if (reactId) {
                uiApi.updateYogaNode(reactId);
            }
        }
    }

    return textNode;
};
