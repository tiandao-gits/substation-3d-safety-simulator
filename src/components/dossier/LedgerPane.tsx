import { Boxes, MapPin, Users } from 'lucide-react';
import {
  ACT_LEDGERS,
  ASSET_KIND_LABELS,
  type DossierAsset,
  type DossierAssetKind,
} from '../../config/dossier';
import { getActPoints, type Act1PointId, type ActNo } from '../../game/act1';
import { Badge, DossierPane, PaneHeading, PointTag, RailItem, RailLabel } from './ui';

const KIND_ICON: Record<DossierAssetKind, typeof Boxes> = {
  equipment: Boxes,
  personnel: Users,
  site: MapPin,
};

const KIND_TONE: Record<DossierAssetKind, 'sky' | 'amber' | 'emerald'> = {
  equipment: 'sky',
  personnel: 'amber',
  site: 'emerald',
};

const KIND_INTRO: Record<DossierAssetKind, string> = {
  equipment:
    '本幕检查涉及的设备、部件与临时设施。型号与运行状态以现场台账为准，读数与铭牌不一致时以现场为准。',
  personnel:
    '本幕涉及的人员、角色与资格。姓名以工作票与现场胸牌为准，同一岗位在不同幕可能由不同人员担任。',
  site:
    '本幕作业的场地、通道与警戒范围。场地条件是判断"能不能站在这里检查"的前提。',
};

/** 左栏副标题要短，避免 272px 索引栏里出现省略号。 */
const KIND_SUBTITLE: Record<DossierAssetKind, string> = {
  equipment: '设备 / 部件 / 临时设施',
  personnel: '人员 / 角色 / 资格',
  site: '场地 / 通道 / 警戒范围',
};

function AssetCard({
  asset,
  points,
  onOpenPoint,
}: {
  asset: DossierAsset;
  points: { id: Act1PointId; name: string }[];
  onOpenPoint: (pointId: Act1PointId) => void;
}) {
  const related = asset.points
    .map((id) => points.find((point) => point.id === id))
    .filter((point): point is { id: Act1PointId; name: string } => Boolean(point));

  return (
    <article className="flex flex-col rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[13.5px] font-bold leading-5 text-slate-900">{asset.name}</h4>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-slate-500">
            {asset.code}
          </div>
        </div>
        <Badge tone={KIND_TONE[asset.kind]}>{ASSET_KIND_LABELS[asset.kind]}</Badge>
      </div>

      <p className="mt-2 text-[12px] leading-5 text-slate-600">{asset.summary}</p>

      <dl className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100 bg-slate-50/70">
        {asset.specs.map((spec) => (
          <div
            key={spec.label}
            className="flex items-baseline justify-between gap-3 px-2.5 py-1"
          >
            <dt className="shrink-0 text-[10.5px] text-slate-500">{spec.label}</dt>
            <dd className="text-right font-mono text-[11px] font-bold leading-4 text-slate-800">
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-slate-500">
        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
        {asset.note}
      </p>

      {related.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
          {related.map((point) => (
            <PointTag
              key={point.id}
              name={point.name}
              onClick={() => onOpenPoint(point.id)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function LedgerPane({
  act,
  kind,
  onKindChange,
  onOpenPoint,
}: {
  act: ActNo;
  kind: DossierAssetKind;
  onKindChange: (kind: DossierAssetKind) => void;
  onOpenPoint: (pointId: Act1PointId) => void;
}) {
  const ledger = ACT_LEDGERS[act];
  const points = getActPoints(act).map((point) => ({ id: point.id, name: point.name }));
  const groups: { kind: DossierAssetKind; label: string; items: DossierAsset[] }[] = [
    { kind: 'equipment', label: '设备', items: ledger.equipment },
    { kind: 'personnel', label: '人员 / 班组', items: ledger.personnel },
    { kind: 'site', label: '场地 / 环境', items: ledger.sites },
  ];
  const current = groups.find((group) => group.kind === kind) ?? groups[0];
  const CurrentIcon = KIND_ICON[current.kind];

  const rail = (
    <>
      <RailLabel>本幕台账</RailLabel>
      {groups.map((group) => {
        const Icon = KIND_ICON[group.kind];
        return (
          <RailItem
            key={group.kind}
            active={current.kind === group.kind}
            onClick={() => onKindChange(group.kind)}
            title={group.label}
            subtitle={KIND_SUBTITLE[group.kind]}
            leading={<Icon className="h-4 w-4" />}
            badge={`${group.items.length}`}
            badgeTone={KIND_TONE[group.kind]}
          />
        );
      })}
    </>
  );

  return (
    <DossierPane rail={rail} scrollKey={current.kind}>
      <div className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <PaneHeading
            eyebrow={`EQUIPMENT LEDGER · ${ASSET_KIND_LABELS[current.kind]}`}
            title={`${current.label}台账`}
            description={KIND_INTRO[current.kind]}
            right={
              <span className="flex items-center gap-1.5">
                <CurrentIcon className="h-4 w-4 text-slate-400" />
                <Badge tone={KIND_TONE[current.kind]}>{current.items.length} 项</Badge>
              </span>
            }
          />
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          {current.items.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              points={points}
              onOpenPoint={onOpenPoint}
            />
          ))}
        </div>
      </div>
    </DossierPane>
  );
}
