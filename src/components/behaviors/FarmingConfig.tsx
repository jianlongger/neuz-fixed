import styled from 'styled-components'

import BooleanSlider from '../config/BooleanSlider'
import ConfigLabel from '../config/ConfigLabel'
import ConfigTable from '../config/ConfigTable'
import ConfigTableRow from '../config/ConfigTableRow'
import NumericInput from '../config/NumericInput'
import ColorSelector from '../config/ColorSelector'

import SlotBar from '../SlotBar'
import { createSlotBars, FarmingConfigModel } from '../../models/BotConfig'
import { useEffect, useRef, useState } from 'react'
import { FrontendInfoModel } from '../../models/FrontendInfo'
import Modal from '../Modal'
import useModal from '../utils/UseModal'
import YesNoModal from '../YesNoModal'
import { MsFormat, StopWatchValues } from '../utils/StopWatch'
import { DefaultValuesChecker } from '../utils/DefaultValuesChecker'
import TimeInput from '../config/TimeInput'

type Props = {
    className?: string,
    info: FrontendInfoModel | null,
    config: FarmingConfigModel,
    onChange: (config: FarmingConfigModel) => void,
    botStopWatch: StopWatchValues | null,
    botState: string,
}

const FarmingConfig = ({ className, info, config, onChange, botStopWatch, botState }: Props) => {
    const statsModal = useModal()
    const debugModal = useModal()
    const debugWarningModal = useModal(debugModal)
    const onDeathModal = useModal(debugModal)
    const onAFKModal = useModal()

    const mobsNameDebugModal = useModal(debugModal)
    const mobsColorsDebugModal = useModal(mobsNameDebugModal)
    const resetSlotYesNo = useModal(debugModal)
    const obstacleAvoidanceDebugModal = useModal(debugModal)

    const selectedMobType = useRef(0)

    const defaultValues = {
        'passive_mobs_colors': [234, 234, 149],
        'passive_tolerence': 5,
        'aggressive_mobs_colors': [179, 23, 23],
        'aggressive_tolerence': 10,
        'passive_mobs_colors_extra': [],
        'aggressive_mobs_colors_extra': [],
        'require_health_bar': false,
        'health_bar_margin': 30,
        'obstacle_avoidance_cooldown': 3000,
        'obstacle_avoidance_max_try': 3,
        'min_mobs_name_width': 15,
        'max_mobs_name_width': 180,
        'circle_pattern_rotation_duration': 30,
        'min_hp_attack': 30,
        'farm_radius': 0,
        'scan_margin_top': 0,
        'scan_margin_bottom': 0,
        'scan_margin_left': 0,
        'scan_margin_right': 0,
        'prevent_already_attacked': true,
        'prioritize_aggro': true,
        'interval_between_buffs': 2000,
        'aoe_farming': 1,
    }

    DefaultValuesChecker(config, defaultValues, onChange)

    const colorsRefResetter = [
        () => onChange({...config, ...{passive_mobs_colors: defaultValues['passive_mobs_colors'], passive_tolerence: defaultValues['passive_tolerence']} }),
        () => onChange({...config, ...{aggressive_mobs_colors: defaultValues['aggressive_mobs_colors'], aggressive_tolerence: defaultValues['aggressive_tolerence']} })
    ]

    const [debugMode, setDebugMode] = useState(false);

    useEffect(() => {
        if (debugMode) {
            debugWarningModal.open()
        }
    }, [debugMode])
    // StopWatchs
    const searchMobStopWatch = MsFormat(info?.last_search_duration ?? 0),
    fightStopWatch = MsFormat(info?.last_fight_duration ?? 0)

    const globalKPM = ((info?.enemy_kill_count?? 0) / Math.round(Number(botStopWatch?.timer ?? 0) / 60000)).toFixed(2)
    const globalKPH = (Number(globalKPM) * 60).toFixed(2)

    return (
        <div className={className}>
            <SlotBar botMode="farming" config={config} onChange={onChange} />
            {/* DEBUG */}
            <YesNoModal isShowing={resetSlotYesNo.isShown} hide={resetSlotYesNo.close}
                title={<h4>确认重置所有技能槽？此操作不可撤销</h4>}
                onYes={() => {onChange({ ...config, slot_bars: createSlotBars() })}}/>
            <Modal isShowing={debugModal.isShown} hide={debugModal.close} title={<h4>设置</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        label={<ConfigLabel name="怪物检测" helpText="" />}
                        item={<button onClick={mobsNameDebugModal.open}>⚙️</button>}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="避让" helpText="" />}
                        item={<button onClick={obstacleAvoidanceDebugModal.open}>⚙️</button>}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="死亡事件" helpText="" />}
                        item={<button onClick={onDeathModal.open}>⚙️</button>}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="Buff 间隔" helpText="" />}
                        item={<TimeInput value={config.interval_between_buffs} onChange={value => onChange({...config, interval_between_buffs: value})} />}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="调试模式" />}
                        item={<BooleanSlider value={debugMode} onChange={value => setDebugMode(value)} />}
                    />

                    <ConfigTableRow
                        label={<ConfigLabel name="重置所有技能槽" helpText="" />}
                        item={<button onClick={resetSlotYesNo.open}>⚙️</button>}
                    />
                </ConfigTable>
            }/>
            <Modal isShowing={mobsColorsDebugModal.isShown} hide={mobsColorsDebugModal.close} title={(selectedMobType.current === 0)? <h4>被动怪检测</h4> : <h4>主动怪检测</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="颜色" helpText="怪物名字颜色参考。如果你确定在做什么，可修改这些值。" />}
                        item={<ColorSelector value={(selectedMobType.current === 0)? config.passive_mobs_colors ?? [] : config.aggressive_mobs_colors ?? []} onChange={value => onChange?.((selectedMobType.current === 0)?{ ...config, passive_mobs_colors: value}: { ...config, aggressive_mobs_colors: value})} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="容差" helpText="怪物名字颜色容差。如果你确定在做什么，可修改这些值。" />}
                        item={<NumericInput min={0} max={255} unit="#" value={(selectedMobType.current === 0)? config.passive_tolerence : config.aggressive_tolerence} onChange={value => onChange?.((selectedMobType.current === 0)? { ...config, passive_tolerence: value } : { ...config, aggressive_tolerence: value })} />}
                    />
                    <ConfigTableRow
                    layout="v"
                        label={<ConfigLabel name="" helpText="" />}
                        item={<button onClick={()=>colorsRefResetter[selectedMobType.current]()}>重置</button>}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="附加颜色" helpText="若同一区域有其它名字颜色的怪物（如红怪、绿怪），可在这里追加颜色样本，每行一个。留空则只使用上方主颜色。" />}
                        item={
                            <div>
                                {(() => {
                                    const list: number[][] = (selectedMobType.current === 0
                                        ? (config.passive_mobs_colors_extra ?? [])
                                        : (config.aggressive_mobs_colors_extra ?? []));
                                    const keyName = selectedMobType.current === 0
                                        ? 'passive_mobs_colors_extra'
                                        : 'aggressive_mobs_colors_extra';
                                    return list.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <ColorSelector value={c} onChange={v => {
                                            const arr = list.slice();
                                            arr[i] = v;
                                            onChange?.({ ...config, [keyName]: arr });
                                        }} />
                                        <button onClick={() => {
                                            const arr = list.slice();
                                            arr.splice(i, 1);
                                            onChange?.({ ...config, [keyName]: arr });
                                        }}>×</button>
                                    </div>
                                )); })()}
                                <button onClick={() => {
                                    const addList: number[][] = (selectedMobType.current === 0
                                        ? (config.passive_mobs_colors_extra ?? [])
                                        : (config.aggressive_mobs_colors_extra ?? []));
                                    const addKey = selectedMobType.current === 0
                                        ? 'passive_mobs_colors_extra'
                                        : 'aggressive_mobs_colors_extra';
                                    const arr = addList.slice();
                                    arr.push([255, 0, 0]);
                                    onChange?.({ ...config, [addKey]: arr });
                                }}>+ 添加颜色</button>
                            </div>
                        }
                    />
                </ConfigTable>
            }/>
            <Modal isShowing={obstacleAvoidanceDebugModal.isShown} hide={obstacleAvoidanceDebugModal.close} title={<h4>避让</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="避开已被攻击的怪" helpText="检查怪物是否已被攻击，若是则避开。组队时须关闭。" />}
                        item={<BooleanSlider value={config.prevent_already_attacked ?? true} onChange={value => onChange?.({ ...config, prevent_already_attacked: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="卡住后避让冷却" helpText="怪物血量不变时，多久后尝试移动或脱身。" />}
                        item={<TimeInput value={config.obstacle_avoidance_cooldown} onChange={value => onChange({...config, obstacle_avoidance_cooldown: value})} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="避让最大尝试次数" helpText="尝试这么多次后放弃攻击并寻找新目标。" />}
                        item={<NumericInput unit='#' value={config.obstacle_avoidance_max_try} onChange={value => onChange({...config, obstacle_avoidance_max_try: value})} />}
                    />
                </ConfigTable>
            }/>
            <Modal isShowing={mobsNameDebugModal.isShown} hide={mobsNameDebugModal.close} title={<h4>怪物检测</h4>} body={
                <ConfigTable>
                    { debugMode &&
                    <>
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="被动怪检测" helpText="" />}
                            item={<button onClick={() => {
                                selectedMobType.current = 0
                                mobsColorsDebugModal.open()
                            }}>⚙️</button>}
                        />
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="主动怪检测" helpText="" />}
                            item={<button onClick={() => {
                                selectedMobType.current = 1
                                mobsColorsDebugModal.open()
                            }}>⚙️</button>}
                        />
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="怪物名最小宽度" helpText="" />}
                            item={<NumericInput unit='px' value={config.min_mobs_name_width} onChange={value => onChange({...config, min_mobs_name_width: value})} />}
                        />
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="怪物名最大宽度" helpText="" />}
                            item={<NumericInput unit='px' value={config.max_mobs_name_width} onChange={value => onChange({...config, max_mobs_name_width: value})} />}
                        />
                    </> }
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="绕圈巡逻时长" helpText="机器人会绕圈移动以寻找目标。设为 0 则原地不动；值越小圈越大。默认 30。" />}
                        item={<NumericInput value={config.circle_pattern_rotation_duration} onChange={value => onChange?.({ ...config, circle_pattern_rotation_duration: value })} />}
                    />

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="刷怪范围(像素)" helpText="以角色当前所在位置（开始刷怪时的位置）为圆心，仅在该半径内选取并攻击怪物，并停止自动走位巡逻，避免角色跑远。0 = 不限制。" />}
                        item={<NumericInput unit='px' min={0} max={2000} value={config.farm_radius ?? 0} onChange={value => onChange?.({ ...config, farm_radius: value })} />}
                    />

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="扫描边距(上)" helpText="从画面顶部开始跳过多少像素再开始检测怪物，用于排除顶部血条/增益栏等 UI。0 = 不跳过。" />}
                        item={<NumericInput unit='px' min={0} max={1000} value={config.scan_margin_top ?? 0} onChange={value => onChange?.({ ...config, scan_margin_top: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="扫描边距(下)" helpText="从画面底部向上跳过多少像素，用于排除底部技能栏等 UI。0 = 不跳过。" />}
                        item={<NumericInput unit='px' min={0} max={1000} value={config.scan_margin_bottom ?? 0} onChange={value => onChange?.({ ...config, scan_margin_bottom: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="扫描边距(左)" helpText="从画面左侧开始跳过多少像素，用于排除左侧聊天/队伍栏等 UI。0 = 不跳过。" />}
                        item={<NumericInput unit='px' min={0} max={1000} value={config.scan_margin_left ?? 0} onChange={value => onChange?.({ ...config, scan_margin_left: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="扫描边距(右)" helpText="从画面右侧向内跳过多少像素，用于排除右侧小地图等 UI。0 = 不跳过。" />}
                        item={<NumericInput unit='px' min={0} max={1000} value={config.scan_margin_right ?? 0} onChange={value => onChange?.({ ...config, scan_margin_right: value })} />}
                    />

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="攻击所需最低血量%" helpText="攻击怪物所需的最低血量（仅被动怪）。" />}
                        item={<NumericInput unit='%' value={config.min_hp_attack} onChange={value => onChange({...config, min_hp_attack: value})} />}
                    />


                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="同时攻击的最大怪数" helpText="同时攻击的怪物最大数量。" />}
                        item={<NumericInput value={config.aoe_farming} onChange={value => onChange?.({ ...config, aoe_farming: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="优先主动怪" helpText="选择目标时优先主动怪。" />}
                        item={<BooleanSlider value={config.prioritize_aggro ?? true} onChange={value => onChange?.({ ...config, prioritize_aggro: value })} />}
                    />

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="仅锁定带血条的怪物" helpText="开启后，只有名字颜色附近出现红/绿血条的色块才判定为怪，可大幅减少把 UI / 特效误当成怪。若发现怪不再被识别，请关闭此项。" />}
                        item={<BooleanSlider value={config.require_health_bar ?? false} onChange={value => onChange?.({ ...config, require_health_bar: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="血条搜索范围(像素)" helpText="在怪物名字上/下方多少像素范围内寻找血条。默认 30。" />}
                        item={<NumericInput unit='px' min={0} max={200} value={config.health_bar_margin ?? 30} onChange={value => onChange?.({ ...config, health_bar_margin: value })} />}
                    />

                </ConfigTable>
            }/>
            <Modal isShowing={debugWarningModal.isShown} hide={debugWarningModal.close}
            title={<h4>警告 - 调试模式</h4>} body={
                <div className='modalCenteredContent'>
                    <h1>警告！</h1>
                    <h2>仅限高级用户！若设置后出现问题，无需惊慌，重置你的配置即可。</h2>
                </div>
            }/>
            {/* DEBUG END */}
            <Modal isShowing={onDeathModal.isShown} hide={onDeathModal.close}
            title={<h4>自动断开</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        label={<ConfigLabel name="无怪超时" helpText="若这么长时间没找到怪，角色将断开连接。" />}
                        item={<TimeInput value={config.mobs_timeout} onChange={value => onChange({...config, mobs_timeout: value})} />}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="断开连接" helpText="开启则自动断开，否则等待复活。" />}
                        item={<BooleanSlider value={config.on_death_disconnect ?? true} onChange={value => onChange?.({ ...config, on_death_disconnect: value })} />}
                    />
                </ConfigTable>
            }/>

            <Modal isShowing={onAFKModal.isShown} hide={onAFKModal.close}
                   title={<h4>挂机行为</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="断开连接" helpText="开启则自动断开挂机角色。" />}
                        item={<BooleanSlider value={config.on_afk_disconnect ?? false} onChange={value => onChange?.({ ...config, on_afk_disconnect: value })} />}
                    />

                    <ConfigTableRow
                        label={<ConfigLabel name="无操作超时" helpText="若开启挂机断开，超过此时长角色将断开。" />}
                        item={<TimeInput value={config.afk_timeout} onChange={value => onChange({...config, afk_timeout: value})} />}
                    />

                </ConfigTable>
            }/>

            <Modal isShowing={statsModal.isShown} hide={statsModal.close}
            title={<h4>统计</h4>} body={
                <div className="stats">
                    <div className="stats__state">
                        <span className={`stats__badge stats__badge--${botState}`}>{botState}</span>
                    </div>

                    <div className="stats__section">
                        <div className="stats__section-title">本次会话</div>
                        <div className="stats__grid">
                            <div className="stats__card">
                                <span className="stats__label">击杀</span>
                                <span className="stats__value">{info?.enemy_kill_count ?? 0}</span>
                            </div>
                            <div className="stats__card">
                                <span className="stats__label">挂机时长</span>
                                <span className="stats__value stats__value--time">{botStopWatch?.toString() ?? "00:00:00:000"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="stats__section">
                        <div className="stats__section-title">上次击杀</div>
                        <div className="stats__grid">
                            <div className="stats__card">
                                <span className="stats__label">搜索耗时</span>
                                <span className="stats__value stats__value--time">{searchMobStopWatch}</span>
                            </div>
                            <div className="stats__card">
                                <span className="stats__label">战斗耗时</span>
                                <span className="stats__value stats__value--time">{fightStopWatch}</span>
                            </div>
                        </div>
                    </div>

                    <div className="stats__section">
                        <div className="stats__section-title">效率</div>
                        <div className="stats__grid">
                            <div className="stats__card">
                                <span className="stats__label">近期每分钟击杀</span>
                                <span className="stats__value">{info?.kill_min_avg?.toFixed(2) ?? 0}</span>
                            </div>
                            <div className="stats__card">
                                <span className="stats__label">近期每小时击杀</span>
                                <span className="stats__value">{info?.kill_hour_avg?.toFixed(2) ?? 0}</span>
                            </div>
                            <div className="stats__card">
                                <span className="stats__label">总每分钟击杀</span>
                                <span className="stats__value">{globalKPM === "NaN" || globalKPM === "Infinity" ? "0.00" : globalKPM}</span>
                            </div>
                            <div className="stats__card">
                                <span className="stats__label">总每小时击杀</span>
                                <span className="stats__value">{globalKPH === "NaN" || globalKPH === "Infinity" ? "0.00" : globalKPH}</span>
                            </div>
                        </div>
                    </div>
                </div>
            }/>
            {info && (
                <div className="info">
                    <div className="row">
                        <div>状态：{ botState }</div>
                    </div>
                    <div className="row">
                        <div>目标检测：{ config.is_stop_fighting? "🛑" : "✅" }</div>
                    </div>
                    <button className="btn sm"
                            onClick={e => onChange?.({ ...config, is_stop_fighting: !config.is_stop_fighting })} >
                            检测 🎯
                    </button>
                    <div className="row">
                        <button className="btn sm" onClick={statsModal.open}>统计 📊</button>
                        <button className="btn sm" onClick={debugModal.open}>设置 ⚙️</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default styled(FarmingConfig)`
    & .modalCenteredContent {
        text-align: center;
    }
`
