import * as React from 'react';
import { CornerProps, DefaultContainerProps, InstanceItemProps, SelectionEventProps, StyleOf } from '../../types';
import {
    LayoutStyleProperties,
    transformLayoutStyleProperties
} from '../../styleTransformers/transformLayoutStyleProperties';
import { useYogaLayout } from '../../hooks/useYogaLayout';
import { transformBlendProperties, BlendStyleProperties } from '../../styleTransformers/transformBlendProperties';
import {
    GeometryStyleProperties,
    transformGeometryStyleProperties
} from '../../styleTransformers/transformGeometryStyleProperties';
import { YogaStyleProperties } from '../../yoga/YogaStyleProperties';
import { StyleSheet } from '../../helpers/StyleSheet';
import { useSelectionChange } from '../../hooks/useSelectionChange';
import { transformAutoLayoutToYoga } from '../../styleTransformers/transformAutoLayoutToYoga';
import { OnLayoutHandlerProps, useOnLayoutHandler } from '../../hooks/useOnLayoutHandler';
import { useImageHash } from '../../hooks/useImageHash';
import { useNodeIdCallback } from '../../hooks/useNodeIdCallback';

export interface SvgNodeProps
    extends DefaultContainerProps,
        InstanceItemProps,
        SelectionEventProps,
        OnLayoutHandlerProps {
    style?: StyleOf<GeometryStyleProperties & YogaStyleProperties & LayoutStyleProperties & BlendStyleProperties>;
    source?: string;
}

const Svg: React.FC<SvgNodeProps> = props => {
    const nodeRef = React.useRef();

    useSelectionChange(nodeRef, props);
    useNodeIdCallback(nodeRef, props.onNodeId);

    const style = { ...StyleSheet.flatten(props.style), ...transformAutoLayoutToYoga(props) };

    const imageHash = useImageHash(style.backgroundImage);

    const frameProps = {
        ...transformLayoutStyleProperties(style),
        ...transformBlendProperties(style),
        ...transformGeometryStyleProperties('backgrounds', style, imageHash),
        ...props,
        style
    };
    const yogaChildProps = useYogaLayout({ nodeRef, ...frameProps });
    useOnLayoutHandler(yogaChildProps, props);

    return <svg {...frameProps} {...yogaChildProps} innerRef={nodeRef} />;
};

export { Svg };
