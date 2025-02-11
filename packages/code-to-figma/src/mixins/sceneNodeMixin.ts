import { SceneNodeProps } from '../types';
import { propsAssign } from '../helpers/propsAssign';

export const sceneNodeMixin = propsAssign<SceneNodeProps, SceneNodeProps>(['visible', 'locked'], {
    visible: true,
    locked: false
});
