import type { BackpackDisplayItem } from '../config/gameText';

interface ToolSpriteProps {
  item: BackpackDisplayItem;
  className?: string;
}

/**
 * 九宫格工具图的单格裁切。
 * 图集整体与单格均为 16:9；容器保持 16:9 后按 3×3 偏移取图，
 * 图片不会被横向拉伸。路径统一走 BASE_URL，避免子路径部署时 404。
 */
export function ToolSprite({ item, className = '' }: ToolSpriteProps) {
  return (
    <div
      className={`relative aspect-video overflow-hidden bg-slate-100 ${className}`}
    >
      <img
        src={item.image}
        alt={item.label}
        draggable={false}
        loading="eager"
        decoding="async"
        className="absolute h-[300%] w-[300%] max-w-none object-fill"
        style={{
          left: `${-item.spriteCol * 100}%`,
          top: `${-item.spriteRow * 100}%`,
        }}
      />
    </div>
  );
}
