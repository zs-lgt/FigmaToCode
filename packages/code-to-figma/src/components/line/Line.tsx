import * as React from 'react';
import {
    DefaultShapeProps,
    BorderProps,
    CornerProps,
    StyleOf,
    InstanceItemProps,
    SelectionEventProps
} from '../../types';
import {
    LayoutStyleProperties,
    transformLayoutStyleProperties
} from '../../styleTransformers/transformLayoutStyleProperties';
import {
    GeometryStyleProperties,
    transformGeometryStyleProperties
} from '../../styleTransformers/transformGeometryStyleProperties';
import { useYogaLayout } from '../../hooks/useYogaLayout';
import { transformBlendProperties, BlendStyleProperties } from '../../styleTransformers/transformBlendProperties';
import { YogaStyleProperties } from '../../yoga/YogaStyleProperties';
import { StyleSheet } from '../..';
import { useSelectionChange } from '../../hooks/useSelectionChange';
import { transformAutoLayoutToYoga } from '../../styleTransformers/transformAutoLayoutToYoga';
import { OnLayoutHandlerProps, useOnLayoutHandler } from '../../hooks/useOnLayoutHandler';
import { useImageHash } from '../../hooks/useImageHash';
import { useNodeIdCallback } from '../../hooks/useNodeIdCallback';

export interface LineProps
    extends DefaultShapeProps,
        CornerProps,
        BorderProps,
        InstanceItemProps,
        SelectionEventProps,
        OnLayoutHandlerProps {
    style?: StyleOf<YogaStyleProperties & LayoutStyleProperties & GeometryStyleProperties & BlendStyleProperties>;
}

const Line: React.FC<LineProps> = props => {
    const nodeRef = React.useRef();

    useSelectionChange(nodeRef, props);
    useNodeIdCallback(nodeRef, props.onNodeId);

    const style = { ...StyleSheet.flatten(props.style), ...transformAutoLayoutToYoga(props) };

    const imageHash = useImageHash(style.backgroundImage);

    const lineProps = {
        ...transformLayoutStyleProperties(style),
        ...transformGeometryStyleProperties('fills', style, imageHash),
        ...transformBlendProperties(style),
        ...props,
        style
    };

    const yogaProps = useYogaLayout({ nodeRef, ...lineProps });
    useOnLayoutHandler(yogaProps, props);

    return <line {...lineProps} {...yogaProps} innerRef={nodeRef} />;
};

export { Line };
