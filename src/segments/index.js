// 工艺段注册表：新增工艺段只需在此登记，UI 与编排器自动识别。
// 每个条目：{ id, name, subtitle, factory } —— factory 返回 SegmentBase 子类实例。
import { PlantSceneSegment } from './PlantSceneSegment.js';
import { OverviewSegment } from './OverviewSegment.js';
import { IntakeSegment } from './IntakeSegment.js';
import { PretreatmentSegment } from './PretreatmentSegment.js';
import { UFSegment } from './UFSegment.js';
import { HighPressureERDSegment } from './HighPressureERDSegment.js';
import { ROSegment } from './ROSegment.js';
import { PostTreatmentSegment } from './PostTreatmentSegment.js';
import { BrineDischargeSegment } from './BrineDischargeSegment.js';

export const SEGMENTS = [
  // 厂区全景：海水/海岸/山地/七段厂房/厂区设施（新增，默认打开）
  { id: 'plant', name: '厂区全景', subtitle: 'Coastal SWRO Plant', factory: () => new PlantSceneSegment() },
  { id: 'overview', name: '全流程总览', subtitle: 'SWRO Overview', factory: () => new OverviewSegment() },
  { id: 'intake', name: '一 取水段', subtitle: 'Intake', factory: () => new IntakeSegment() },
  { id: 'pretreatment', name: '二 预处理段', subtitle: 'Pretreatment', factory: () => new PretreatmentSegment() },
  { id: 'uf', name: '三 UF/MF 膜法预处理', subtitle: 'UF / MF', factory: () => new UFSegment() },
  { id: 'hp_erd', name: '四 高压泵 + 能量回收', subtitle: 'HP Pump + ERD', factory: () => new HighPressureERDSegment() },
  { id: 'ro', name: '五 反渗透膜段', subtitle: 'Reverse Osmosis', factory: () => new ROSegment() },
  { id: 'post', name: '六 后处理 / 矿化', subtitle: 'Post-treatment', factory: () => new PostTreatmentSegment() },
  { id: 'brine', name: '七 浓盐水排放', subtitle: 'Brine Discharge', factory: () => new BrineDischargeSegment() }
];
