export type BackgroundId =
  | 'blank'
  | 'lined'
  | 'wideLined'
  | 'grid'
  | 'dots'
  | 'isometric'
  | 'cornell'
  | 'music'
  | 'checklist'
  | 'columns'
  | 'kraft'
  | 'dark';

export type CanvasTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'shape'
  | 'eraser'
  | 'lasso'
  | 'text'
  | 'sticker';

export type EraserMode = 'partial' | 'whole';

export type LassoMode = 'free' | 'rect';

export type ShapeKind =
  | 'line'
  | 'dashedLine'
  | 'arrow'
  | 'doubleArrow'
  | 'rect'
  | 'roundedRect'
  | 'ellipse'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'heart'
  | 'cloud'
  | 'callout'
  | 'checkmark'
  | 'cross'
  | 'wave'
  | 'bracket';

export type StickerVariant = 'note' | 'tape' | 'tag' | 'badge' | 'card' | 'outline';

export type ImageMask =
  | 'none'
  | 'circle'
  | 'diamond'
  | 'star'
  | 'heart'
  | 'hexagon';

export type Point = {
  x: number;
  y: number;
  width?: number;
  pressure?: number;
};

export type LayerItem = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type TextAlignH = 'left' | 'center' | 'right';
export type TextAlignV = 'top' | 'middle' | 'bottom';

export type TextElement = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height?: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  rotation: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignH?: TextAlignH;
  alignV?: TextAlignV;
  layerId?: string;
  order?: number;
  zIndex?: number;
};

export type CropRect = {
  /** 0..1 от ширины/высоты исходника */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ImageElement = {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;
  uri: string;
  rotation: number;
  cornerRadius: number;
  mask: ImageMask;
  crop?: CropRect;
  layerId?: string;
  order?: number;
  zIndex?: number;
};

export type StickerElement = {
  id: string;
  type: 'sticker';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tone: string;
  variant: StickerVariant;
  rotation: number;
  layerId?: string;
  order?: number;
  zIndex?: number;
};

export type CanvasElement = TextElement | ImageElement | StickerElement;

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity?: number;
  groupId?: string;
  layerId?: string;
  order?: number;
  zIndex?: number;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  folder: string;
  pinned: boolean;
  background: BackgroundId;
  paperColor: string;
  lineColor: string;
  pageFullScreen?: boolean;
  pageWidth?: number;
  pageHeight?: number;
  layers: LayerItem[];
  activeLayerId: string;
  elements: CanvasElement[];
  strokes: Stroke[];
  updatedAt: number;
  createdAt: number;
};

export type NotePatch = Partial<
  Pick<
    Note,
    | 'title'
    | 'body'
    | 'folder'
    | 'pinned'
    | 'background'
    | 'paperColor'
    | 'lineColor'
    | 'pageFullScreen'
    | 'pageWidth'
    | 'pageHeight'
    | 'layers'
    | 'activeLayerId'
    | 'elements'
    | 'strokes'
  >
>;
