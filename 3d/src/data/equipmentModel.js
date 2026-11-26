// ============================================================================
// 海水淡化（SWRO）全流程 · 设备数据模型
// ----------------------------------------------------------------------------
// 本文件是「设备台账 + 连接关系 + 层级结构 + 物料流转」的单一数据源，
// 可被 3D 总览段、HUD 设备面板、设备查询/导出功能直接消费。
//
// 模型依据：项目实际七段工艺（取水→预处理→UF/MF→高压泵+ERD→RO→后处理矿化→浓盐水排放），
// 并融合膜法水处理科普资料中的「膜工艺层级/压力阶梯/前端风险传递链」知识：
//   · 膜精度层级：MBR→UF→NF→RO→EDI（截留尺度由毫米级逐级降至离子级）
//   · 压力阶梯：   UF≤2bar(低压) → NF 2~10bar(中压) → RO 10~40bar(高压) → EDI≈0~2bar(电驱动)
//   · 风险传递：   原水→预处理→UF→NF→RO→EDI→产水，上游风险逐级向下传递
// ============================================================================

// ----------------------------------------------------------------------------
// 1. 枚举（类型 / 介质 / 运行状态）
// ----------------------------------------------------------------------------
export const ENUMS = {
  // 设备类型
  EquipmentType: {
    INTAKE_HEAD: '取水头部',
    BAR_SCREEN: '拦污格栅',
    PUMP: '泵',
    AGITATOR: '搅拌器',
    FILTER_TANK: '过滤罐',
    DOSING_UNIT: '加药装置',
    MEMBRANE_RACK: '膜组件架',
    MEMBRANE_ELEMENT: '膜元件',
    PRESSURE_VESSEL: '压力容器',
    HP_PUMP: '高压泵',
    ERD: '能量回收装置',
    BOOST_PUMP: '增压泵',
    COLLECTOR: '集管',
    TANK: '储罐/水池',
    DIFFUSER: '排放扩散器',
    PIPE: '管道',
  },
  // 设备大类（用于统计/分组）
  Category: {
    ROTATING: '动设备',
    STATIC: '静设备',
    MEMBRANE: '膜分离设备',
    PIPING: '管道管件',
  },
  // 介质（沿程物料）
  Medium: {
    SEAWATER: '海水',
    RAW_WATER: '原水',
    PRETREATED: '预处理水',
    UF_PERMEATE: 'UF产水(保安水)',
    HP_FEED: '高压进料',
    PERMEATE: '产水(淡水)',
    BRINE: '浓盐水',
    CHEMICAL: '药剂',
    PRODUCT: '产品水',
  },
  // 运行状态
  Status: {
    RUNNING: '运行',
    STANDBY: '备用',
    MAINTENANCE: '维护',
    STOPPED: '停机',
    FAULT: '故障',
  },
  // 连接管线类型
  LineType: {
    FEED: '进料',
    PRODUCT: '产水',
    BRINE: '浓水',
    CHEMICAL: '药剂',
    DRAIN: '排污',
    ENERGY: '能量回收',
    RECYCLE: '循环/反洗',
  },
};

// ----------------------------------------------------------------------------
// 2. 设备实例（核心属性）
//    字段说明见《设备数据模型说明.md》"关键字段"。
// ----------------------------------------------------------------------------
export const EQUIPMENT = [
  // ===== 一 取水段（intake）=====
  { id: 'eq_in_head',   code: 'IN-HEAD-01', name: '海水取水头部',   type: ENUMS.EquipmentType.INTAKE_HEAD, category: ENUMS.Category.STATIC,    segmentId: 'intake',     groupId: 'grp_intake_intake', capacity: { value: 60000, unit: 'm³/d' }, designPressure: { value: 1, unit: 'bar' },   operatingPressure: { min: 0, max: 0.5, unit: 'bar' }, medium: ENUMS.Medium.SEAWATER,   status: ENUMS.Status.RUNNING,    specs: { 结构形式: '重力式渗渠', 取水深度: '海面下8~12m', 防海生物: '铜合金+间歇氯' }, position: { x: -18, y: 0, z: 0 }, note: '避开表层油污与泥沙，取低温深层水', dataSource: '海水取水设计规范' },
  { id: 'eq_in_bar',    code: 'IN-BAR-01',  name: '旋转式拦污格栅', type: ENUMS.EquipmentType.BAR_SCREEN, category: ENUMS.Category.ROTATING,   segmentId: 'intake',     groupId: 'grp_intake_intake', capacity: { value: 60000, unit: 'm³/d' }, designPressure: { value: 1, unit: 'bar' },   operatingPressure: { min: 0, max: 0.5, unit: 'bar' }, medium: ENUMS.Medium.SEAWATER,   status: ENUMS.Status.RUNNING,    specs: { 栅隙: '20mm', 清污方式: '旋转齿耙', 功率: '2.2kW' }, position: { x: -16, y: 0, z: 0 }, note: '拦截漂浮物与大颗粒', dataSource: '科普图·前端风险传递链' },
  { id: 'eq_in_pump_a', code: 'IN-PUMP-01', name: '取水泵 A',       type: ENUMS.EquipmentType.PUMP,       category: ENUMS.Category.ROTATING,   segmentId: 'intake',     groupId: 'grp_intake_pump',   capacity: { value: 2500, unit: 'm³/h' }, designPressure: { value: 6, unit: 'bar' },   operatingPressure: { min: 2, max: 5, unit: 'bar' }, medium: ENUMS.Medium.SEAWATER,   status: ENUMS.Status.RUNNING,    specs: { 型式: '卧式离心泵', 扬程: '40m', 功率: '355kW', 材质: '双相钢' }, position: { x: -14, y: 0, z: 1 }, note: '一用一备', dataSource: '取水泵选型' },
  { id: 'eq_in_pump_b', code: 'IN-PUMP-02', name: '取水泵 B',       type: ENUMS.EquipmentType.PUMP,       category: ENUMS.Category.ROTATING,   segmentId: 'intake',     groupId: 'grp_intake_pump',   capacity: { value: 2500, unit: 'm³/h' }, designPressure: { value: 6, unit: 'bar' },   operatingPressure: { min: 2, max: 5, unit: 'bar' }, medium: ENUMS.Medium.SEAWATER,   status: ENUMS.Status.STANDBY,    specs: { 型式: '卧式离心泵', 扬程: '40m', 功率: '355kW', 材质: '双相钢' }, position: { x: -14, y: 0, z: -1 }, note: '备用泵', dataSource: '取水泵选型' },
  { id: 'eq_in_pipe',   code: 'IN-PIPE-01', name: '海水引水管',     type: ENUMS.EquipmentType.PIPE,       category: ENUMS.Category.PIPING,     segmentId: 'intake',     groupId: 'grp_intake_intake', capacity: { value: 60000, unit: 'm³/d' }, designPressure: { value: 6, unit: 'bar' },   operatingPressure: { min: 2, max: 5, unit: 'bar' }, medium: ENUMS.Medium.SEAWATER,   status: ENUMS.Status.RUNNING,    specs: { 管径: 'DN1200', 材质: 'GRP/钢管', 长度: '1200m' }, position: { x: -12, y: 0, z: 0 }, note: '陆域输送至厂区', dataSource: '引水工程设计' },

  // ===== 二 预处理段（pretreatment）=====
  { id: 'eq_pt_mix',    code: 'PT-MIX-01',  name: '混凝絮凝池+搅拌机', type: ENUMS.EquipmentType.AGITATOR, category: ENUMS.Category.STATIC,    segmentId: 'pretreatment', groupId: 'grp_pt_coag',    capacity: { value: 60000, unit: 'm³/d' }, designPressure: { value: 1, unit: 'bar' },   operatingPressure: { min: 0, max: 1, unit: 'bar' }, medium: ENUMS.Medium.RAW_WATER,  status: ENUMS.Status.RUNNING,    specs: { 停留时间: '20min', 搅拌功率: '7.5kW', G值: '50~80s⁻¹' }, position: { x: -10, y: 0, z: 0 }, note: '投加PAC/PAM使胶体脱稳', dataSource: '渤海湾海水混凝-超滤研究' },
  { id: 'eq_pt_flt_a',  code: 'PT-FLT-01',  name: '砂滤罐 A',        type: ENUMS.EquipmentType.FILTER_TANK, category: ENUMS.Category.STATIC,  segmentId: 'pretreatment', groupId: 'grp_pt_filt',    capacity: { value: 30000, unit: 'm³/d' }, designPressure: { value: 3, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.PRETREATED, status: ENUMS.Status.RUNNING,    specs: { 滤料: '石英砂+无烟煤', 滤速: '8m/h', 反洗: '气水联合' }, position: { x: -8, y: 0, z: 1 }, note: '去除悬浮物，SDI<3', dataSource: 'moruiwater 预处理设计指南' },
  { id: 'eq_pt_flt_b',  code: 'PT-FLT-02',  name: '砂滤罐 B',        type: ENUMS.EquipmentType.FILTER_TANK, category: ENUMS.Category.STATIC,  segmentId: 'pretreatment', groupId: 'grp_pt_filt',    capacity: { value: 30000, unit: 'm³/d' }, designPressure: { value: 3, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.PRETREATED, status: ENUMS.Status.RUNNING,    specs: { 滤料: '石英砂+无烟煤', 滤速: '8m/h', 反洗: '气水联合' }, position: { x: -8, y: 0, z: -1 }, note: '与A并联/串联，一用一备反洗', dataSource: 'moruiwater 预处理设计指南' },
  { id: 'eq_pt_dos',    code: 'PT-DOS-01',  name: '加药装置 (PAC/PAM/NaClO)', type: ENUMS.EquipmentType.DOSING_UNIT, category: ENUMS.Category.ROTATING, segmentId: 'pretreatment', groupId: 'grp_pt_coag', capacity: { value: 0, unit: '—' }, designPressure: { value: 4, unit: 'bar' }, operatingPressure: { min: 1, max: 3, unit: 'bar' }, medium: ENUMS.Medium.CHEMICAL, status: ENUMS.Status.RUNNING, specs: { 药剂: 'PAC/PAM/次氯酸钠', 投加量: '5~15mg/L', 计量泵: '隔膜式' }, position: { x: -10, y: 1.5, z: 2 }, note: '混凝剂/助凝剂/杀菌剂', dataSource: '科普图·总工边界决策表(保护单元)' },

  // ===== 三 UF/MF 膜法预处理（uf）=====
  { id: 'eq_uf_feed',   code: 'UF-FEED-01', name: 'UF 进料泵',       type: ENUMS.EquipmentType.PUMP,       category: ENUMS.Category.ROTATING,   segmentId: 'uf',          groupId: 'grp_uf_aux',     capacity: { value: 2250, unit: 'm³/h' }, designPressure: { value: 4, unit: 'bar' },   operatingPressure: { min: 1, max: 2.5, unit: 'bar' }, medium: ENUMS.Medium.PRETREATED, status: ENUMS.Status.RUNNING,    specs: { 型式: '卧式离心泵', TMP: '≤2bar', 功率: '75kW' }, position: { x: -3, y: 0, z: 2 }, note: 'UF 属低压工艺（≤2bar）', dataSource: '科普图·压力能耗阶梯(UF≤2bar)' },
  { id: 'eq_uf_mod',    code: 'UF-MOD-01',  name: 'UF 膜组件架 (PVDF中空纤维×6)', type: ENUMS.EquipmentType.MEMBRANE_RACK, category: ENUMS.Category.MEMBRANE, segmentId: 'uf', groupId: 'grp_uf_rack', capacity: { value: 2250, unit: 'm³/h' }, designPressure: { value: 3, unit: 'bar' }, operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.PRETREATED, status: ENUMS.Status.RUNNING, specs: { 膜材质: 'PVDF中空纤维', 截留孔径: '0.02μm', 通量: '50~70LMH', 回收率: '95%', 反洗: '每30min' }, position: { x: -1, y: 0, z: 0 }, note: 'RO 终极保安，产水SDI<1', dataSource: 'Yang等2009；Sorek大型SWROUF预处理' },
  { id: 'eq_uf_prod',   code: 'UF-PROD-01', name: 'UF 产水集管',     type: ENUMS.EquipmentType.COLLECTOR,  category: ENUMS.Category.STATIC,    segmentId: 'uf',          groupId: 'grp_uf_rack',    capacity: { value: 2150, unit: 'm³/h' }, designPressure: { value: 3, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.UF_PERMEATE, status: ENUMS.Status.RUNNING, specs: { 材质: 'UPVC', 口径: 'DN500' }, position: { x: -1, y: 2, z: 0 }, note: '汇集各膜柱透过液', dataSource: 'UF 系统设计' },
  { id: 'eq_uf_brine',  code: 'UF-BRINE-01', name: 'UF 浓水排放',    type: ENUMS.EquipmentType.PIPE,       category: ENUMS.Category.PIPING,     segmentId: 'uf',          groupId: 'grp_uf_rack',    capacity: { value: 100, unit: 'm³/h' },  designPressure: { value: 3, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.BRINE,     status: ENUMS.Status.RUNNING,    specs: { 管径: 'DN200', 去向: '回海水/预处理' }, position: { x: -1, y: -1, z: 0 }, note: '浓水约5%排放', dataSource: 'UF 系统设计' },
  { id: 'eq_uf_bw',     code: 'UF-BW-01',   name: 'UF 反洗泵',       type: ENUMS.EquipmentType.PUMP,       category: ENUMS.Category.ROTATING,   segmentId: 'uf',          groupId: 'grp_uf_aux',     capacity: { value: 900, unit: 'm³/h' },  designPressure: { value: 4, unit: 'bar' },   operatingPressure: { min: 1, max: 2.5, unit: 'bar' }, medium: ENUMS.Medium.PRETREATED, status: ENUMS.Status.STANDBY, specs: { 用途: '气水反洗', 周期: '30min' }, position: { x: -3, y: 0, z: -2 }, note: '错用易堵膜、频繁反洗（科普警示）', dataSource: '科普图·五类膜主战场(UF风险)' },
  { id: 'eq_uf_cip',    code: 'UF-CIP-01',  name: 'CIP 清洗罐',      type: ENUMS.EquipmentType.TANK,       category: ENUMS.Category.STATIC,    segmentId: 'uf',          groupId: 'grp_uf_aux',     capacity: { value: 20, unit: 'm³' },    designPressure: { value: 3, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.CHEMICAL, status: ENUMS.Status.STANDBY, specs: { 清洗剂: '柠檬酸/NaOH', 周期: '季度' }, position: { x: -3, y: -1, z: 1 }, note: '离线化学清洗', dataSource: 'UF 系统维护' },

  // ===== 四 高压泵 + 能量回收（hp_erd）=====
  { id: 'eq_hp_pump',   code: 'HP-PUMP-01', name: '高压泵 (多级离心泵)', type: ENUMS.EquipmentType.HP_PUMP, category: ENUMS.Category.ROTATING, segmentId: 'hp_erd', groupId: 'grp_hp_boost', capacity: { value: 1125, unit: 'm³/h' }, designPressure: { value: 85, unit: 'bar' }, operatingPressure: { min: 55, max: 70, unit: 'bar' }, medium: ENUMS.Medium.UF_PERMEATE, status: ENUMS.Status.RUNNING, specs: { 型式: '多级离心泵', 出口压力: '60bar', 功率: '~5MW', 材质: '双相钢' }, position: { x: 4, y: 0, z: 1 }, note: '主升压设备，RO能耗主体', dataSource: '科普图·压力能耗阶梯(RO 10~40bar,能耗较高)' },
  { id: 'eq_hp_motor',  code: 'HP-MOTOR-01', name: '高压泵驱动电机',  type: ENUMS.EquipmentType.PUMP,       category: ENUMS.Category.ROTATING, segmentId: 'hp_erd', groupId: 'grp_hp_boost', capacity: { value: 0, unit: '—' }, designPressure: { value: 0, unit: 'bar' }, operatingPressure: { min: 0, max: 0, unit: 'bar' }, medium: ENUMS.Medium.RAW_WATER, status: ENUMS.Status.RUNNING, specs: { 功率: '5000kW', 电压: '10kV', 型式: '高压电机' }, position: { x: 4, y: 1.5, z: 1 }, note: '与高压泵直连', dataSource: '高压泵配套' },
  { id: 'eq_hp_boost',  code: 'HP-BOOST-01', name: '增压泵 (PX后补压)', type: ENUMS.EquipmentType.BOOST_PUMP, category: ENUMS.Category.ROTATING, segmentId: 'hp_erd', groupId: 'grp_hp_boost', capacity: { value: 1125, unit: 'm³/h' }, designPressure: { value: 85, unit: 'bar' }, operatingPressure: { min: 55, max: 70, unit: 'bar' }, medium: ENUMS.Medium.HP_FEED, status: ENUMS.Status.RUNNING, specs: { 型式: '多级离心泵', 补压: '2~3bar', 功率: '~200kW' }, position: { x: 4, y: 0, z: -1 }, note: 'PX 输出升压后再补压至60bar', dataSource: 'ERD 系统设计' },
  { id: 'eq_erd_px',    code: 'ERD-PX-01',  name: '能量回收装置 PX',  type: ENUMS.EquipmentType.ERD,       category: ENUMS.Category.MEMBRANE,  segmentId: 'hp_erd', groupId: 'grp_hp_boost', capacity: { value: 1125, unit: 'm³/h' }, designPressure: { value: 85, unit: 'bar' }, operatingPressure: { min: 55, max: 70, unit: 'bar' }, medium: ENUMS.Medium.BRINE, status: ENUMS.Status.RUNNING, specs: { 型式: '压力交换器(PX)', 效率: '>95%', 回收功率: '~4MW' }, position: { x: 4, y: -1, z: 0 }, note: '用浓水高压驱动低压进料升压', dataSource: 'ERI PX 能量回收技术' },

  // ===== 五 反渗透膜段（ro）=====
  { id: 'eq_ro_pv',     code: 'RO-PV-01',   name: 'RO 压力容器组 (双排)', type: ENUMS.EquipmentType.PRESSURE_VESSEL, category: ENUMS.Category.MEMBRANE, segmentId: 'ro', groupId: 'grp_ro_rack', capacity: { value: 2250, unit: 'm³/h' }, designPressure: { value: 85, unit: 'bar' }, operatingPressure: { min: 55, max: 70, unit: 'bar' }, medium: ENUMS.Medium.HP_FEED, status: ENUMS.Status.RUNNING, specs: { 壳数: '双排×8支', 单壳装膜: '7支', 膜型式: '卷式SWRO' }, position: { x: 12, y: 0, z: 0 }, note: '海水RO主机，脱盐率>99.4%', dataSource: 'SWRO 膜系统设计' },
  { id: 'eq_ro_elem',   code: 'RO-ELEM-01', name: 'RO 膜元件 (SWRO)',  type: ENUMS.EquipmentType.MEMBRANE_ELEMENT, category: ENUMS.Category.MEMBRANE, segmentId: 'ro', groupId: 'grp_ro_rack', capacity: { value: 0, unit: '—' }, designPressure: { value: 85, unit: 'bar' }, operatingPressure: { min: 55, max: 70, unit: 'bar' }, medium: ENUMS.Medium.HP_FEED, status: ENUMS.Status.RUNNING, specs: { 有效面积: '37m²/支', 通量: '12~15LMH', 回收率: '47%' }, position: { x: 12, y: 0.5, z: 0 }, note: '父设备 RO-PV-01；怕结垢/Cl₂氧化(科普警示)', dataSource: '科普图·总工边界决策表(RO怕结垢/Cl₂)' },
  { id: 'eq_ro_prod',   code: 'RO-PROD-01', name: 'RO 产水集管',      type: ENUMS.EquipmentType.COLLECTOR,  category: ENUMS.Category.STATIC,    segmentId: 'ro',          groupId: 'grp_ro_rack',    capacity: { value: 1060, unit: 'm³/h' }, designPressure: { value: 6, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.PERMEATE, status: ENUMS.Status.RUNNING, specs: { 材质: 'UPVC', 口径: 'DN400', TDS: '<300ppm' }, position: { x: 12, y: 2, z: 0 }, note: '汇集淡水侧透过液', dataSource: 'RO 系统设计' },
  { id: 'eq_ro_brine',  code: 'RO-BRINE-01', name: 'RO 浓水排放',     type: ENUMS.EquipmentType.PIPE,       category: ENUMS.Category.PIPING,     segmentId: 'ro',          groupId: 'grp_ro_rack',    capacity: { value: 1190, unit: 'm³/h' }, designPressure: { value: 85, unit: 'bar' },  operatingPressure: { min: 55, max: 68, unit: 'bar' }, medium: ENUMS.Medium.BRINE, status: ENUMS.Status.RUNNING, specs: { 管径: 'DN300', TDS: '~70000ppm', 压力: '58bar' }, position: { x: 12, y: -1, z: 0 }, note: '高压浓水先经PX回收能量', dataSource: 'SWRO 浓水设计' },
  { id: 'eq_ro_boost',  code: 'RO-BOOST-01', name: 'RO 段间增压泵',   type: ENUMS.EquipmentType.BOOST_PUMP, category: ENUMS.Category.ROTATING, segmentId: 'ro', groupId: 'grp_ro_boost', capacity: { value: 560, unit: 'm³/h' }, designPressure: { value: 85, unit: 'bar' }, operatingPressure: { min: 30, max: 45, unit: 'bar' }, medium: ENUMS.Medium.HP_FEED, status: ENUMS.Status.STANDBY, specs: { 用途: '二段升压', 功率: '~150kW' }, position: { x: 12, y: -2, z: 1 }, note: '多段RO段间补压', dataSource: 'RO 多段设计' },

  // ===== 六 后处理 / 矿化（post）=====
  { id: 'eq_post_rem',  code: 'POST-REM-01', name: '再矿化接触罐',    type: ENUMS.EquipmentType.TANK,       category: ENUMS.Category.STATIC,    segmentId: 'post',        groupId: 'grp_post_rem',   capacity: { value: 1060, unit: 'm³/h' }, designPressure: { value: 6, unit: 'bar' },   operatingPressure: { min: 0.5, max: 3, unit: 'bar' }, medium: ENUMS.Medium.PERMEATE, status: ENUMS.Status.RUNNING, specs: { 填料: '石灰石/CO₂', 接触时间: '15min', 提升TDS: '至300~500ppm' }, position: { x: 20, y: 0, z: 0 }, note: '淡化水回补矿物质，调节pH', dataSource: '产水矿化设计规范' },
  { id: 'eq_post_dos',  code: 'POST-DOS-01', name: '后处理加药 (pH/消毒)', type: ENUMS.EquipmentType.DOSING_UNIT, category: ENUMS.Category.ROTATING, segmentId: 'post', groupId: 'grp_post_rem', capacity: { value: 0, unit: '—' }, designPressure: { value: 6, unit: 'bar' }, operatingPressure: { min: 1, max: 4, unit: 'bar' }, medium: ENUMS.Medium.CHEMICAL, status: ENUMS.Status.RUNNING, specs: { 药剂: 'CO₂/石灰/NaClO', 投加: 'pH6.5~8.5' }, position: { x: 20, y: 1.5, z: 1 }, note: 'pH调节与消毒', dataSource: '后处理设计' },
  { id: 'eq_post_dis',  code: 'POST-DIS-01', name: '消毒单元 (UV/NaClO)', type: ENUMS.EquipmentType.DOSING_UNIT, category: ENUMS.Category.ROTATING, segmentId: 'post', groupId: 'grp_post_rem', capacity: { value: 1060, unit: 'm³/h' }, designPressure: { value: 6, unit: 'bar' }, operatingPressure: { min: 0.5, max: 3, unit: 'bar' }, medium: ENUMS.Medium.PRODUCT, status: ENUMS.Status.RUNNING, specs: { 方式: 'UV+余氯', 剂量: '0.5~1mg/L' }, position: { x: 22, y: 0, z: 0 }, note: '保障管网生物稳定性', dataSource: '饮用水消毒规范' },
  { id: 'eq_post_tank', code: 'POST-TANK-01', name: '清水池',         type: ENUMS.EquipmentType.TANK,       category: ENUMS.Category.STATIC,    segmentId: 'post',        groupId: 'grp_post_rem',   capacity: { value: 5000, unit: 'm³' },   designPressure: { value: 2, unit: 'bar' },   operatingPressure: { min: 0, max: 1, unit: 'bar' }, medium: ENUMS.Medium.PRODUCT, status: ENUMS.Status.RUNNING, specs: { 容积: '5000m³', 停留: '调节用' }, position: { x: 24, y: 0, z: 0 }, note: '产品水储存与外输缓冲', dataSource: '清水池设计' },

  // ===== 七 浓盐水排放（brine）=====
  { id: 'eq_dis_pipe',  code: 'DIS-PIPE-01', name: '浓水放流管',      type: ENUMS.EquipmentType.PIPE,       category: ENUMS.Category.PIPING,     segmentId: 'brine',       groupId: 'grp_dis',       capacity: { value: 1190, unit: 'm³/h' }, designPressure: { value: 10, unit: 'bar' },  operatingPressure: { min: 0.5, max: 3, unit: 'bar' }, medium: ENUMS.Medium.BRINE, status: ENUMS.Status.RUNNING, specs: { 管径: 'DN600', 入海: '海底敷设' }, position: { x: 28, y: -1, z: 0 }, note: 'PX后低压浓水输送', dataSource: '浓水排放设计' },
  { id: 'eq_dis_dif',   code: 'DIS-DIF-01',  name: '多端口扩散器',    type: ENUMS.EquipmentType.DIFFUSER,   category: ENUMS.Category.STATIC,    segmentId: 'brine',       groupId: 'grp_dis',       capacity: { value: 1190, unit: 'm³/h' }, designPressure: { value: 6, unit: 'bar' },   operatingPressure: { min: 0.5, max: 2, unit: 'bar' }, medium: ENUMS.Medium.BRINE, status: ENUMS.Status.RUNNING, specs: { 端口数: '多', 掺混: '快速稀释', 排放浓度: '<本地2倍' }, position: { x: 30, y: -2, z: 0 }, note: '海域掺混稀释，降低环境影响', dataSource: '海洋排放扩散器设计' },
];

// ----------------------------------------------------------------------------
// 3. 设备间连接与物料流转关系（有向边）
//    每条边表示一股物料/能量从 from 设备流向 to 设备。
// ----------------------------------------------------------------------------
export const CONNECTIONS = [
  // —— 取水段内 / 取水→预处理 ——
  { id: 'cn01', from: 'IN-HEAD-01', to: 'IN-BAR-01',   medium: ENUMS.Medium.SEAWATER,     flowRate: { value: 60000, unit: 'm³/d' }, pipeSize: 'DN1200', lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn02', from: 'IN-BAR-01',  to: 'IN-PUMP-01',  medium: ENUMS.Medium.SEAWATER,     flowRate: { value: 60000, unit: 'm³/d' }, pipeSize: 'DN1000', lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn03', from: 'IN-PUMP-01', to: 'IN-PIPE-01',  medium: ENUMS.Medium.SEAWATER,     flowRate: { value: 60000, unit: 'm³/d' }, pipeSize: 'DN1000', lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn04', from: 'IN-PUMP-02', to: 'IN-PIPE-01',  medium: ENUMS.Medium.SEAWATER,     flowRate: { value: 60000, unit: 'm³/d' }, pipeSize: 'DN1000', lineType: ENUMS.LineType.FEED,     direction: '旁通', isBranch: true },
  { id: 'cn05', from: 'IN-PIPE-01', to: 'PT-MIX-01',   medium: ENUMS.Medium.RAW_WATER,    flowRate: { value: 60000, unit: 'm³/d' }, pipeSize: 'DN1000', lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },

  // —— 预处理段内 / 预处理→UF ——
  { id: 'cn06', from: 'PT-DOS-01',  to: 'PT-MIX-01',   medium: ENUMS.Medium.CHEMICAL,     flowRate: { value: 0, unit: '—' },        pipeSize: 'DN25',  lineType: ENUMS.LineType.CHEMICAL, direction: '正向', isBranch: true },
  { id: 'cn07', from: 'PT-MIX-01',  to: 'PT-FLT-01',   medium: ENUMS.Medium.PRETREATED,   flowRate: { value: 60000, unit: 'm³/d' }, pipeSize: 'DN800',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn08', from: 'PT-FLT-01',  to: 'PT-FLT-02',   medium: ENUMS.Medium.PRETREATED,   flowRate: { value: 57000, unit: 'm³/d' }, pipeSize: 'DN800',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn09', from: 'PT-FLT-02',  to: 'UF-FEED-01',  medium: ENUMS.Medium.PRETREATED,   flowRate: { value: 57000, unit: 'm³/d' }, pipeSize: 'DN700',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },

  // —— UF 段内 / UF→高压泵 ——
  { id: 'cn10', from: 'UF-FEED-01', to: 'UF-MOD-01',   medium: ENUMS.Medium.PRETREATED,   flowRate: { value: 57000, unit: 'm³/d' }, pipeSize: 'DN600',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn11', from: 'UF-MOD-01',  to: 'UF-PROD-01',  medium: ENUMS.Medium.UF_PERMEATE, flowRate: { value: 54000, unit: 'm³/d' }, pipeSize: 'DN500',  lineType: ENUMS.LineType.PRODUCT,  direction: '正向', isBranch: false },
  { id: 'cn12', from: 'UF-MOD-01',  to: 'UF-BRINE-01', medium: ENUMS.Medium.BRINE,       flowRate: { value: 3000, unit: 'm³/d' },  pipeSize: 'DN200',  lineType: ENUMS.LineType.DRAIN,    direction: '正向', isBranch: true },
  { id: 'cn13', from: 'UF-BW-01',   to: 'UF-MOD-01',   medium: ENUMS.Medium.PRETREATED,   flowRate: { value: 0, unit: '—' },        pipeSize: 'DN300', lineType: ENUMS.LineType.RECYCLE,  direction: '回流', isBranch: true },
  { id: 'cn14', from: 'UF-CIP-01',  to: 'UF-MOD-01',   medium: ENUMS.Medium.CHEMICAL,     flowRate: { value: 0, unit: '—' },        pipeSize: 'DN100', lineType: ENUMS.LineType.RECYCLE,  direction: '循环', isBranch: true },

  // —— 高压泵 + 能量回收（核心升压与能量回收逻辑）——
  { id: 'cn15', from: 'UF-PROD-01', to: 'HP-PUMP-01',  medium: ENUMS.Medium.UF_PERMEATE, flowRate: { value: 27000, unit: 'm³/d' }, pipeSize: 'DN250',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn16', from: 'HP-PUMP-01', to: 'RO-PV-01',    medium: ENUMS.Medium.HP_FEED,     flowRate: { value: 27000, unit: 'm³/d' }, pipeSize: 'DN250',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn17', from: 'UF-PROD-01', to: 'ERD-PX-01',   medium: ENUMS.Medium.UF_PERMEATE, flowRate: { value: 27000, unit: 'm³/d' }, pipeSize: 'DN250',  lineType: ENUMS.LineType.ENERGY,   direction: '正向', isBranch: true },
  { id: 'cn18', from: 'RO-BRINE-01', to: 'ERD-PX-01',  medium: ENUMS.Medium.BRINE,       flowRate: { value: 30000, unit: 'm³/d' }, pipeSize: 'DN300',  lineType: ENUMS.LineType.ENERGY,   direction: '正向', isBranch: false },
  { id: 'cn19', from: 'ERD-PX-01',  to: 'HP-BOOST-01', medium: ENUMS.Medium.HP_FEED,     flowRate: { value: 27000, unit: 'm³/d' }, pipeSize: 'DN250',  lineType: ENUMS.LineType.ENERGY,   direction: '正向', isBranch: false },
  { id: 'cn20', from: 'HP-BOOST-01', to: 'RO-PV-01',   medium: ENUMS.Medium.HP_FEED,     flowRate: { value: 27000, unit: 'm³/d' }, pipeSize: 'DN250',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },

  // —— RO 段内 / RO 分流 ——
  { id: 'cn21', from: 'RO-PV-01',   to: 'RO-PROD-01',  medium: ENUMS.Medium.PERMEATE,     flowRate: { value: 26000, unit: 'm³/d' }, pipeSize: 'DN400',  lineType: ENUMS.LineType.PRODUCT,  direction: '正向', isBranch: false },
  { id: 'cn22', from: 'RO-PV-01',   to: 'RO-BRINE-01', medium: ENUMS.Medium.BRINE,       flowRate: { value: 30000, unit: 'm³/d' }, pipeSize: 'DN300',  lineType: ENUMS.LineType.BRINE,    direction: '正向', isBranch: false },
  { id: 'cn23', from: 'RO-BRINE-01', to: 'RO-BOOST-01', medium: ENUMS.Medium.HP_FEED,    flowRate: { value: 0, unit: '—' },        pipeSize: 'DN150', lineType: ENUMS.LineType.FEED,     direction: '旁通', isBranch: true },

  // —— 浓盐水排放 ——
  { id: 'cn24', from: 'ERD-PX-01',  to: 'DIS-PIPE-01', medium: ENUMS.Medium.BRINE,       flowRate: { value: 30000, unit: 'm³/d' }, pipeSize: 'DN300',  lineType: ENUMS.LineType.BRINE,    direction: '正向', isBranch: false },
  { id: 'cn25', from: 'DIS-PIPE-01', to: 'DIS-DIF-01', medium: ENUMS.Medium.BRINE,       flowRate: { value: 30000, unit: 'm³/d' }, pipeSize: 'DN600',  lineType: ENUMS.LineType.BRINE,    direction: '正向', isBranch: false },

  // —— 产水 → 后处理矿化 → 产品水 ——
  { id: 'cn26', from: 'RO-PROD-01', to: 'POST-REM-01', medium: ENUMS.Medium.PERMEATE,    flowRate: { value: 26000, unit: 'm³/d' }, pipeSize: 'DN400',  lineType: ENUMS.LineType.PRODUCT,  direction: '正向', isBranch: false },
  { id: 'cn27', from: 'POST-REM-01', to: 'POST-DOS-01', medium: ENUMS.Medium.PRODUCT,    flowRate: { value: 26000, unit: 'm³/d' }, pipeSize: 'DN350',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn28', from: 'POST-DOS-01', to: 'POST-DIS-01', medium: ENUMS.Medium.PRODUCT,    flowRate: { value: 26000, unit: 'm³/d' }, pipeSize: 'DN350',  lineType: ENUMS.LineType.FEED,     direction: '正向', isBranch: false },
  { id: 'cn29', from: 'POST-DIS-01', to: 'POST-TANK-01', medium: ENUMS.Medium.PRODUCT,   flowRate: { value: 26000, unit: 'm³/d' }, pipeSize: 'DN400',  lineType: ENUMS.LineType.PRODUCT,  direction: '正向', isBranch: false },
];

// ----------------------------------------------------------------------------
// 4. 设备层级结构（厂区 → 工艺段 → 设备组 → 设备）
// ----------------------------------------------------------------------------
export const HIERARCHY = {
  id: 'plant', name: '江河海 SWRO 海水淡化厂', type: 'plant',
  children: [
    { id: 'seg_intake', name: '一 取水段', type: 'segment', segmentId: 'intake', children: [
      { id: 'grp_intake_intake', name: '取水头部组', type: 'group', children: [
        { id: 'eq_in_head', name: '海水取水头部', type: 'equipment', code: 'IN-HEAD-01' },
        { id: 'eq_in_bar',  name: '旋转式拦污格栅', type: 'equipment', code: 'IN-BAR-01' },
        { id: 'eq_in_pipe', name: '海水引水管', type: 'equipment', code: 'IN-PIPE-01' },
      ]},
      { id: 'grp_intake_pump', name: '取水泵组', type: 'group', children: [
        { id: 'eq_in_pump_a', name: '取水泵 A', type: 'equipment', code: 'IN-PUMP-01' },
        { id: 'eq_in_pump_b', name: '取水泵 B', type: 'equipment', code: 'IN-PUMP-02' },
      ]},
    ]},
    { id: 'seg_pretreatment', name: '二 预处理段', type: 'segment', segmentId: 'pretreatment', children: [
      { id: 'grp_pt_coag', name: '混凝加药组', type: 'group', children: [
        { id: 'eq_pt_mix', name: '混凝絮凝池+搅拌机', type: 'equipment', code: 'PT-MIX-01' },
        { id: 'eq_pt_dos', name: '加药装置', type: 'equipment', code: 'PT-DOS-01' },
      ]},
      { id: 'grp_pt_filt', name: '过滤组', type: 'group', children: [
        { id: 'eq_pt_flt_a', name: '砂滤罐 A', type: 'equipment', code: 'PT-FLT-01' },
        { id: 'eq_pt_flt_b', name: '砂滤罐 B', type: 'equipment', code: 'PT-FLT-02' },
      ]},
    ]},
    { id: 'seg_uf', name: '三 UF/MF 膜法预处理', type: 'segment', segmentId: 'uf', children: [
      { id: 'grp_uf_rack', name: 'UF 膜堆组', type: 'group', children: [
        { id: 'eq_uf_mod',   name: 'UF 膜组件架', type: 'equipment', code: 'UF-MOD-01' },
        { id: 'eq_uf_prod',  name: 'UF 产水集管', type: 'equipment', code: 'UF-PROD-01' },
        { id: 'eq_uf_brine', name: 'UF 浓水排放', type: 'equipment', code: 'UF-BRINE-01' },
      ]},
      { id: 'grp_uf_aux', name: 'UF 辅助组', type: 'group', children: [
        { id: 'eq_uf_feed', name: 'UF 进料泵', type: 'equipment', code: 'UF-FEED-01' },
        { id: 'eq_uf_bw',   name: 'UF 反洗泵', type: 'equipment', code: 'UF-BW-01' },
        { id: 'eq_uf_cip',  name: 'CIP 清洗罐', type: 'equipment', code: 'UF-CIP-01' },
      ]},
    ]},
    { id: 'seg_hp_erd', name: '四 高压泵 + 能量回收', type: 'segment', segmentId: 'hp_erd', children: [
      { id: 'grp_hp_boost', name: '升压回收组', type: 'group', children: [
        { id: 'eq_hp_pump',  name: '高压泵', type: 'equipment', code: 'HP-PUMP-01' },
        { id: 'eq_hp_motor', name: '高压泵驱动电机', type: 'equipment', code: 'HP-MOTOR-01' },
        { id: 'eq_hp_boost', name: '增压泵', type: 'equipment', code: 'HP-BOOST-01' },
        { id: 'eq_erd_px',   name: '能量回收装置 PX', type: 'equipment', code: 'ERD-PX-01' },
      ]},
    ]},
    { id: 'seg_ro', name: '五 反渗透膜段', type: 'segment', segmentId: 'ro', children: [
      { id: 'grp_ro_rack', name: 'RO 膜堆组', type: 'group', children: [
        { id: 'eq_ro_pv',     name: 'RO 压力容器组', type: 'equipment', code: 'RO-PV-01' },
        { id: 'eq_ro_elem',   name: 'RO 膜元件', type: 'equipment', code: 'RO-ELEM-01' },
        { id: 'eq_ro_prod',   name: 'RO 产水集管', type: 'equipment', code: 'RO-PROD-01' },
        { id: 'eq_ro_brine',  name: 'RO 浓水排放', type: 'equipment', code: 'RO-BRINE-01' },
      ]},
      { id: 'grp_ro_boost', name: 'RO 段间增压组', type: 'group', children: [
        { id: 'eq_ro_boost', name: 'RO 段间增压泵', type: 'equipment', code: 'RO-BOOST-01' },
      ]},
    ]},
    { id: 'seg_post', name: '六 后处理 / 矿化', type: 'segment', segmentId: 'post', children: [
      { id: 'grp_post_rem', name: '矿化消毒组', type: 'group', children: [
        { id: 'eq_post_rem',  name: '再矿化接触罐', type: 'equipment', code: 'POST-REM-01' },
        { id: 'eq_post_dos',  name: '后处理加药', type: 'equipment', code: 'POST-DOS-01' },
        { id: 'eq_post_dis',  name: '消毒单元', type: 'equipment', code: 'POST-DIS-01' },
        { id: 'eq_post_tank', name: '清水池', type: 'equipment', code: 'POST-TANK-01' },
      ]},
    ]},
    { id: 'seg_brine', name: '七 浓盐水排放', type: 'segment', segmentId: 'brine', children: [
      { id: 'grp_dis', name: '排放组', type: 'group', children: [
        { id: 'eq_dis_pipe', name: '浓水放流管', type: 'equipment', code: 'DIS-PIPE-01' },
        { id: 'eq_dis_dif',  name: '多端口扩散器', type: 'equipment', code: 'DIS-DIF-01' },
      ]},
    ]},
  ],
};

// ----------------------------------------------------------------------------
// 5. 物料流转（沿程水质/压力/流量/回收率变化）
//    体现实际工艺：海水 → 预处理 → UF(保安) → 高压泵+PX → RO(分产水/浓水) → 矿化 → 产品水
// ----------------------------------------------------------------------------
export const MATERIAL_FLOWS = [
  { node: '海水取水',     medium: ENUMS.Medium.SEAWATER,    TDS_ppm: 35000, pressure_bar: 0,  flow_m3d: 60000, recovery: null,  note: '原海水，温度随季节变化' },
  { node: '预处理后',     medium: ENUMS.Medium.PRETREATED,  TDS_ppm: 35000, pressure_bar: 1,  flow_m3d: 57000, recovery: 0.95, note: '浊度/悬浮物去除，SDI<3' },
  { node: 'UF 产水',      medium: ENUMS.Medium.UF_PERMEATE, TDS_ppm: 35000, pressure_bar: 1,  flow_m3d: 54000, recovery: 0.95, note: 'RO 终极保安，SDI<1' },
  { node: 'RO 高压进料',  medium: ENUMS.Medium.HP_FEED,     TDS_ppm: 35000, pressure_bar: 60, flow_m3d: 54000, recovery: null, note: '经高压泵+PX升压至~60bar' },
  { node: 'RO 产水',      medium: ENUMS.Medium.PERMEATE,    TDS_ppm: 200,   pressure_bar: 0.5, flow_m3d: 26000, recovery: 0.47, note: '脱盐率>99.4%，TDS<300ppm' },
  { node: 'RO 浓水',      medium: ENUMS.Medium.BRINE,       TDS_ppm: 70000, pressure_bar: 58, flow_m3d: 30000, recovery: null, note: '高压浓水，先经PX回收能量' },
  { node: '产品水',       medium: ENUMS.Medium.PRODUCT,     TDS_ppm: 350,   pressure_bar: 2,  flow_m3d: 26000, recovery: null, note: '矿化+消毒后，TDS 300~500ppm' },
];

// ----------------------------------------------------------------------------
// 6. 辅助方法：由 CONNECTIONS 推导每个设备的上游/下游邻接（单一来源，避免冗余）
// ----------------------------------------------------------------------------
export function getAdjacency() {
  const map = {};
  EQUIPMENT.forEach(e => { map[e.code] = { upstream: [], downstream: [] }; });
  CONNECTIONS.forEach(c => {
    if (map[c.from]) map[c.from].downstream.push(c.to);
    if (map[c.to]) map[c.to].upstream.push(c.from);
  });
  return map;
}

// 便捷查询：按设备位号取设备定义
export function getEquipment(code) {
  return EQUIPMENT.find(e => e.code === code) || null;
}
