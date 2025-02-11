import { AutoLayoutProps, LayoutProps } from '../types';
import { YogaStyleProperties } from '../yoga/YogaStyleProperties';

const layoutModeToFlexDirection: Partial<
    { [k in AutoLayoutProps['layoutMode']]: YogaStyleProperties['flexDirection'] }
> = {
    HORIZONTAL: 'row',
    VERTICAL: 'column'
};

const layoutAlignToAlignSelf: Partial<{ [k in LayoutProps['layoutAlign']]: YogaStyleProperties['alignItems'] }> = {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
    STRETCH: 'stretch'
};

const primaryAxisAlignItemsToJustifyContent: Partial<
    { [k in AutoLayoutProps['primaryAxisAlignItems']]: YogaStyleProperties['justifyContent'] }
> = {
    MIN: 'flex-start',
    MAX: 'flex-end',
    CENTER: 'center',
    SPACE_BETWEEN: 'space-between'
};

const counterAxisAlignItemsToAlignItems: Partial<
    { [k in AutoLayoutProps['counterAxisAlignItems']]: YogaStyleProperties['alignItems'] }
> = {
    MIN: 'flex-start',
    MAX: 'flex-end',
    CENTER: 'center'
};

interface AutoLayoutAllProps extends AutoLayoutProps, LayoutProps {}

export const transformAutoLayoutToYoga = (props: AutoLayoutAllProps): Partial<YogaStyleProperties> => {
    return {
        ...(props.layoutMode && layoutModeToFlexDirection[props.layoutMode]
            ? {
                  flexDirection: layoutModeToFlexDirection[props.layoutMode]
              }
            : {}),
        ...(props.layoutAlign && layoutAlignToAlignSelf[props.layoutAlign]
            ? {
                  alignSelf: layoutAlignToAlignSelf[props.layoutAlign]
              }
            : {}),
        ...(props.layoutGrow
            ? {
                  flexGrow: props.layoutGrow
              }
            : {}),
        ...(props.horizontalPadding
            ? {
                  paddingLeft: props.horizontalPadding,
                  paddingRight: props.horizontalPadding
              }
            : {}),
        ...(props.verticalPadding
            ? {
                  paddingTop: props.verticalPadding,
                  paddingBottom: props.verticalPadding
              }
            : {}),
        ...(props.paddingLeft
            ? {
                  paddingLeft: props.paddingLeft
              }
            : {}),
        ...(props.paddingRight
            ? {
                  paddingRight: props.paddingRight
              }
            : {}),
        ...(props.paddingTop
            ? {
                  paddingTop: props.paddingTop
              }
            : {}),
        ...(props.paddingBottom
            ? {
                  paddingBottom: props.paddingBottom
              }
            : {}),
        ...(props.primaryAxisAlignItems && primaryAxisAlignItemsToJustifyContent[props.primaryAxisAlignItems]
            ? {
                  justifyContent: primaryAxisAlignItemsToJustifyContent[props.primaryAxisAlignItems]
              }
            : {}),
        ...(props.counterAxisAlignItems && counterAxisAlignItemsToAlignItems[props.counterAxisAlignItems]
            ? {
                  alignItems: counterAxisAlignItemsToAlignItems[props.counterAxisAlignItems]
              }
            : {})
    };
};
