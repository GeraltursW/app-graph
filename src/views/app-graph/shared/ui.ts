import { defineComponent, h } from 'vue';
import {
  Badge as AntBadge,
  Card as AntCard,
  Input as AntInput,
  Tag as AntTag,
} from 'ant-design-vue';

export const Input = AntInput;

export const Badge = defineComponent({
  name: 'GraphBadge',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(AntTag, attrs, slots);
  },
});

export const ScrollArea = defineComponent({
  name: 'GraphScrollArea',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('div', { ...attrs, class: ['graph-scroll-area', attrs.class] }, slots.default?.());
  },
});

export const Card = defineComponent({
  name: 'GraphCard',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        AntCard,
        {
          ...attrs,
          bordered: false,
          class: ['graph-ant-card', attrs.class],
        },
        slots,
      );
  },
});

function createSection(name: string, className: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', { ...attrs, class: [className, attrs.class] }, slots.default?.());
    },
  });
}

export const CardHeader = createSection('GraphCardHeader', 'graph-card-header');
export const CardContent = createSection('GraphCardContent', 'graph-card-content');
export const CardTitle = createSection('GraphCardTitle', 'graph-card-title');

export const StatusBadge = AntBadge;
