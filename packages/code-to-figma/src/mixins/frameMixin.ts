import { propsAssign } from '../helpers/propsAssign';
import { FrameProps } from '../types';

export const frameMixin = propsAssign<FrameProps, FrameProps>(['backgrounds', 'fillStyleId'], {
    backgrounds: []
});
