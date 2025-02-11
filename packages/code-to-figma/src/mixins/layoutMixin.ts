import { LayoutProps } from '../types';
import { isValidSize } from '../helpers/isValidSize';

export const layoutMixin = (node: LayoutMixin & BaseNode) => (props: LayoutProps & { preventResizing?: boolean }) => {
    if (props.preventResizing) {
        return;
    }
    if (props.relativeTransform) {
        node.relativeTransform = props.relativeTransform;
    }
    if (typeof props.x === 'number') {
        node.x = props.x;
    }
    if (typeof props.y === 'number') {
        node.y = props.y;
    }
    if (typeof props.rotation === 'number') {
        node.rotation = props.rotation;
    }
    if ((isValidSize(props.width) || isValidSize(props.height)) && node.type !== 'LINE') {
        if (props.isWithoutConstraints) {
            node.resizeWithoutConstraints(props.width, props.height);
        } else {
            node.resize(
                isValidSize(props.width) ? props.width : node.width,
                isValidSize(props.height) ? props.height : node.height
            );
        }
    }

    if (isValidSize(props.width) && node.type === 'LINE') {
        if (props.isWithoutConstraints) {
            node.resizeWithoutConstraints(props.width, 0);
        } else {
            node.resize(props.width, 0);
        }
    }

    node.layoutAlign = props.layoutAlign || 'INHERIT';
    node.layoutGrow = props.layoutGrow || 0;
};
