import * as React from 'react';
import { $updatedYogaCoords, updateYogaNode } from '../yoga/yogaStream';
import { filter, map } from 'rxjs/operators';
import { YogaStyleProperties } from '../yoga/YogaStyleProperties';

const flatYogaStyle = (style: YogaStyleProperties) => {
    return [
        style && style.position,
        style && style.top,
        style && style.left,
        style && style.right,
        style && style.bottom,
        style && style.width,
        style && style.height,
        style && style.minWidth,
        style && style.maxWidth,
        style && style.minHeight,
        style && style.maxHeight,
        style && style.flexDirection,
        style && style.flexWrap,
        style && style.alignItems,
        style && style.justifyContent,
        style && style.padding,
        style && style.paddingTop,
        style && style.paddingBottom,
        style && style.paddingLeft,
        style && style.paddingRight,
        style && style.paddingVertical,
        style && style.paddingHorizontal,
        style && style.margin,
        style && style.marginTop,
        style && style.marginBottom,
        style && style.marginLeft,
        style && style.marginRight,
        style && style.marginVertical,
        style && style.marginHorizontal,
        style && style.borderWidth,
        style && style.flex,
        style && style.flexGrow,
        style && style.flexShrink,
        style && style.flexBasis,
        style && style.aspectRatio,
        style && style.alignSelf,
        style && style.overflow
    ];
};

export interface CalculatedYogaLayoutProps {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type NullableCalculatedYogaLayoutProps = CalculatedYogaLayoutProps | null;

export const useYogaLayout = props => {
    const { nodeRef } = props;
    // TODO: should be type-annotated to NullableCalculatedYogaLayoutProps
    //  but it leads to TS compiler bug
    const [yogaProps, setYogaProps] = React.useState(null);

    React.useEffect(() => {
        const instance = nodeRef.current;
        const subject = $updatedYogaCoords.pipe(
            filter((message: any) => {
                return instance && message.reactId === instance.reactId;
            }),
            map((message: any) => message.props)
        );

        const subscription = subject.subscribe(props => {
            setYogaProps(props);
        });

        return () => subscription.unsubscribe();
    }, []);

    React.useEffect(() => {
        const instance = nodeRef.current;
        updateYogaNode(instance);
    }, [
        props.children,
        props.width,
        props.height,
        props.characters,
        props.fontSize,
        props.loadedFont,
        ...flatYogaStyle(props.style)
    ]);

    return yogaProps;
};
