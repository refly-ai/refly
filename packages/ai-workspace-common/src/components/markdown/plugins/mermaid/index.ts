import Component from './render';

interface MermaidElementType {
  Component: typeof Component;
  tag: string;
}

const MermaidElement: MermaidElementType = {
  Component,
  tag: 'pre',
};

export default MermaidElement;
