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
import { invoke } from '@tauri-apps/api'
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

type ColorPickTarget = { kind: 'primary' } | { kind: 'extra', index: number }

const FarmingConfig = ({ className, info, config, onChange, botStopWatch, botState }: Props) => {
    const statsModal = useModal()
    const debugModal = useModal()
    const debugWarningModal = useModal(debugModal)
    const onDeathModal = useModal(debugModal)
    const onAFKModal = useModal()

    const scanRegionModal = useModal()
    const [scanPreview, setScanPreview] = useState<{ b64: string, w: number, h: number } | null>(null)
    const [scanError, setScanError] = useState<string | null>(null)

    // Screen colour picker: capture the game window once, then let the user
    // click a pixel on that still image. No DOM is injected into the game
    // window, so the capture used for detection stays clean.
    const colorPickModal = useModal()
    const [colorPreview, setColorPreview] = useState<string | null>(null)
    const [colorPickTarget, setColorPickTarget] = useState<ColorPickTarget | null>(null)

    const openColorPicker = (target: ColorPickTarget) => {
        setColorPickTarget(target)
        setScanError(null)
        invoke('capture_client_preview').then((b64: any) => {
            if (!b64) {
                setScanError('无法截取游戏窗口，请先启动游戏（点“开始”）并确保游戏窗口已打开。')
                return
            }
            setColorPreview(b64)
            colorPickModal.open()
        }).catch(() => setScanError('截图失败，请确认游戏窗口已启动。'))
    }

    const mobsNameDebugModal = useModal(debugModal)
    const mobsColorsDebugModal = useModal(mobsNameDebugModal)
    const resetSlotYesNo = useModal(debugModal)
    const obstacleAvoidanceDebugModal = useModal(debugModal)

    const selectedMobType = useRef(0)

    const defaultValues = {
        'passive_mobs_colors': [234, 234, 149],
        'passive_tolerence': 30,
        'aggressive_mobs_colors': [179, 23, 23],
        'aggressive_tolerence': 30,
        'passive_mobs_colors_extra': [],
        'aggressive_mobs_colors_extra': [],
        'obstacle_avoidance_cooldown': 3000,
        'obstacle_avoidance_max_try': 3,
        'min_mobs_name_width': 15,
        'max_mobs_name_width': 180,
        'circle_pattern_rotation_duration': 30,
        'min_hp_attack': 30,
        'farm_radius': 0,
        'debug_overlay': false,
        'mob_click_offset_y': 10,
        'scan_margin_top': 0,
        'scan_margin_bottom': 0,
        'scan_margin_left': 0,
        'scan_margin_right': 0,
        'prevent_already_attacked': true,
        'prioritize_aggro': true,
        // Explicit default: without it the toggle reads `undefined` and a
        // single click silently turns fighting OFF (the old "检测 🎯" button).
        'is_stop_fighting': false,
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
                        label={<ConfigLabel name="颜色" helpText="怪物名字颜色参考。推荐用「从画面取色」在游戏截图上直接点选怪名文字，比手填 RGB 准。" />}
                        item={
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ColorSelector value={(selectedMobType.current === 0)? config.passive_mobs_colors ?? [] : config.aggressive_mobs_colors ?? []} onChange={value => onChange?.((selectedMobType.current === 0)?{ ...config, passive_mobs_colors: value}: { ...config, aggressive_mobs_colors: value})} />
                                <button onClick={() => openColorPicker({ kind: 'primary' })}>从画面取色</button>
                            </div>
                        }
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="容差" helpText="怪物名字颜色的容差。识别不到怪物时把它调大（30~50）；若把 UI 文字误当成怪，再调小。" />}
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
                                        <button onClick={() => openColorPicker({ kind: 'extra', index: i })}>取色</button>
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
                        label={<ConfigLabel name="调试叠层(显示点击落点)" helpText="开启后会在游戏画面上画出绿色怪物框与彩色点击点。绿框=识别到的怪物名字区域，蓝点=每次点击位置。用于排查点击是否落在怪物身上：若蓝点总在绿框上方空档，就把下方「点击偏移」调大；若蓝点在怪物身体下方地面，就调小。排查完建议关闭以免遮挡画面。" />}
                        item={<BooleanSlider value={config.debug_overlay ?? false} onChange={value => onChange?.({ ...config, debug_overlay: value })} />}
                    />

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="选怪点击偏移(px)" helpText="点击落点 = 怪物名字框底边中心 + 该垂直偏移。默认 10（旧行为）。若点击总落在名字与身体间的空档导致选不中，调大（如 30~50）把落点下移到身体；若点到身体下方地面则调小（如 0~5）。配合「调试叠层」观察后微调。" />}
                        item={<NumericInput unit='px' min={-50} max={200} value={config.mob_click_offset_y ?? 10} onChange={value => onChange?.({ ...config, mob_click_offset_y: value })} />}
                    />

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="扫描区域（框选）" helpText="对游戏画面截图并直接拖拽框选扫描范围，比手填边距直观；框选时绿色边框会实时显示在游戏窗口上回显。点“应用”自动换算成下方四个边距。" />}
                        item={
                            <div>
                                <div
                                    className="btn sm"
                                    onClick={() => {
                                        setScanError(null)
                                        invoke('capture_client_preview').then((b64: any) => {
                                            if (!b64) {
                                                setScanError('无法截取游戏窗口，请先启动游戏（点“开始”）并确保游戏窗口已打开。')
                                                return
                                            }
                                            const img = new Image()
                                            img.onload = () => {
                                                setScanPreview({ b64, w: img.naturalWidth, h: img.naturalHeight })
                                                scanRegionModal.open()
                                            }
                                            img.onerror = () => setScanError('截图加载失败，请重试。')
                                            img.src = 'data:image/png;base64,' + b64
                                        }).catch(() => setScanError('截图失败，请确认游戏窗口已启动。'))
                                    }}
                                >框选扫描区域</div>
                                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                                    当前边距 — 左 {config.scan_margin_left ?? 0} / 右 {config.scan_margin_right ?? 0} / 上 {config.scan_margin_top ?? 0} / 下 {config.scan_margin_bottom ?? 0}（像素）
                                </div>
                                {scanError && <div style={{ marginTop: 4, fontSize: 12, color: '#ff6b6b' }}>{scanError}</div>}
                            </div>
                        }
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

            <Modal isShowing={scanRegionModal.isShown} hide={() => {
                invoke('overlay_scan_region', { rect: null })
                scanRegionModal.close()
            }}
                title={<h4>框选扫描区域</h4>} body={
                    scanPreview ? <ScanRegionPicker
                        b64={scanPreview.b64}
                        imgW={scanPreview.w}
                        imgH={scanPreview.h}
                        onCancel={() => {
                            invoke('overlay_scan_region', { rect: null })
                            scanRegionModal.close()
                        }}
                        onConfirm={(rect) => {
                            // rect is in captured-image (window) pixel coords.
                            // Convert to the four scan margins. IGNORE_AREA_TOP=0 and
                            // IGNORE_AREA_BOTTOM=110 on Windows (the only supported target).
                            const left = Math.round(rect[0])
                            const right = Math.max(0, Math.round(scanPreview.w - (rect[0] + rect[2])))
                            const top = Math.max(0, Math.round(rect[1]))
                            const bottom = Math.max(0, Math.round(scanPreview.h - 110 - (rect[1] + rect[3])))
                            onChange?.({ ...config, scan_margin_left: left, scan_margin_right: right, scan_margin_top: top, scan_margin_bottom: bottom })
                            // The overlay is only a preview. It must be removed as soon as
                            // selection is done, otherwise it covers the target HP bar in
                            // the captured frame and breaks mob/target detection.
                            invoke('overlay_scan_region', { rect: null })
                            scanRegionModal.close()
                        }}
                    /> : undefined
                }
            />

            <Modal isShowing={colorPickModal.isShown} hide={colorPickModal.close}
                title={<h4>从画面取色</h4>} body={
                    colorPreview ? <ScreenColorPicker
                        b64={colorPreview}
                        onCancel={colorPickModal.close}
                        onPick={(rgb) => {
                            const t = colorPickTarget
                            if (t && t.kind === 'primary') {
                                onChange?.(selectedMobType.current === 0
                                    ? { ...config, passive_mobs_colors: rgb }
                                    : { ...config, aggressive_mobs_colors: rgb })
                            } else if (t && t.kind === 'extra') {
                                const keyName = selectedMobType.current === 0
                                    ? 'passive_mobs_colors_extra'
                                    : 'aggressive_mobs_colors_extra'
                                const arr = (selectedMobType.current === 0
                                    ? (config.passive_mobs_colors_extra ?? [])
                                    : (config.aggressive_mobs_colors_extra ?? [])).slice()
                                arr[t.index] = rgb
                                onChange?.({ ...config, [keyName]: arr })
                            }
                            colorPickModal.close()
                        }}
                    /> : undefined
                }
            />

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
                        <div>最近识别到怪物：{ info.detected_mob_count ?? 0 } 只</div>
                    </div>
                    <div className="row">
                        <div>战斗：{ config.is_stop_fighting ? "已暂停（调试）" : "正常" }</div>
                    </div>
                    <button className="btn sm"
                            onClick={e => onChange?.({ ...config, is_stop_fighting: !config.is_stop_fighting })} >
                            { config.is_stop_fighting ? "恢复战斗" : "暂停战斗（调试）" }
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

// 在游戏截图（dataURL）上拖拽框选扫描区域。框选时通过 overlay_scan_region
// 把绿框实时画回游戏窗口做回显。确认时回传 [x, y, w, h]（截图原始像素坐标）。
const ScanRegionPicker = ({ b64, imgW, imgH, onConfirm, onCancel }: {
    b64: string,
    imgW: number,
    imgH: number,
    onConfirm: (rect: [number, number, number, number]) => void,
    onCancel: () => void,
}) => {
    const imgRef = useRef<HTMLImageElement>(null)
    const [sel, setSel] = useState<{ x: number, y: number, w: number, h: number } | null>(null)
    const dragRef = useRef<{ sx: number, sy: number } | null>(null)
    const lastSentRef = useRef<string>('')

    const toNatural = (clientX: number, clientY: number) => {
        const img = imgRef.current!
        const r = img.getBoundingClientRect()
        const scaleX = img.naturalWidth / r.width
        const scaleY = img.naturalHeight / r.height
        return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY }
    }

    const onDown = (e: any) => {
        const p = toNatural(e.clientX, e.clientY)
        dragRef.current = { sx: p.x, sy: p.y }
        setSel({ x: p.x, y: p.y, w: 0, h: 0 })
    }
    const onMove = (e: any) => {
        if (!dragRef.current) return
        const p = toNatural(e.clientX, e.clientY)
        const x = Math.min(dragRef.current.sx, p.x)
        const y = Math.min(dragRef.current.sy, p.y)
        const w = Math.abs(p.x - dragRef.current.sx)
        const h = Math.abs(p.y - dragRef.current.sy)
        const s = { x, y, w, h }
        setSel(s)
        const key = `${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}`
        if (key !== lastSentRef.current) {
            lastSentRef.current = key
            invoke('overlay_scan_region', { rect: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)] })
        }
    }
    const onUp = () => { dragRef.current = null }

    const disp = () => {
        if (!sel || !imgRef.current) return null
        const img = imgRef.current
        const r = img.getBoundingClientRect()
        const scaleX = r.width / img.naturalWidth
        const scaleY = r.height / img.naturalHeight
        return { left: sel.x * scaleX, top: sel.y * scaleY, width: sel.w * scaleX, height: sel.h * scaleY }
    }

    const d = disp()
    return (
        <div>
            <p style={{ fontSize: 12, opacity: 0.85 }}>
                在下方游戏画面上按住鼠标拖拽，框出希望扫描的范围（应避开底部技能栏、顶部血条等 UI）。绿框会实时显示在游戏窗口里回显。
            </p>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
                <img
                    ref={imgRef}
                    src={'data:image/png;base64,' + b64}
                    style={{ maxWidth: '100%', display: 'block', cursor: 'crosshair' }}
                    draggable={false}
                    onMouseDown={onDown}
                    onMouseMove={onMove}
                    onMouseUp={onUp}
                    onMouseLeave={onUp}
                />
                {d && (
                    <div style={{
                        position: 'absolute', left: d.left, top: d.top, width: d.width, height: d.height,
                        border: '3px solid #00e676', boxSizing: 'border-box', pointerEvents: 'none',
                        background: 'rgba(0,230,118,0.08)'
                    }} />
                )}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <div className="btn sm" onClick={() => sel && onConfirm([sel.x, sel.y, sel.w, sel.h])}>应用</div>
                <div className="btn sm" onClick={onCancel}>取消</div>
            </div>
            {sel && (
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>
                    已选：X {Math.round(sel.x)} · Y {Math.round(sel.y)} · 宽 {Math.round(sel.w)} · 高 {Math.round(sel.h)}（原始像素，截图尺寸 {imgW}×{imgH}）
                </div>
            )}
        </div>
    )
}

// Pick a colour from a still capture of the game window. The image is drawn
// into a canvas (data URLs are same-origin, so getImageData is allowed) and a
// 3x3 average reduces antialiasing noise on thin monster-name text.
// No DOM is injected into the game window itself, so detection stays clean.
const ScreenColorPicker = ({ b64, onPick, onCancel }: {
    b64: string,
    onPick: (rgb: number[]) => void,
    onCancel: () => void,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [ready, setReady] = useState(false)
    const [hover, setHover] = useState<{ x: number, y: number, rgb: number[] } | null>(null)
    const [picked, setPicked] = useState<{ x: number, y: number, rgb: number[] } | null>(null)

    useEffect(() => {
        setReady(false)
        setHover(null)
        setPicked(null)
        const img = new Image()
        img.onload = () => {
            const c = canvasRef.current
            if (!c) return
            c.width = img.naturalWidth
            c.height = img.naturalHeight
            const ctx = c.getContext('2d')
            if (!ctx) return
            ctx.drawImage(img, 0, 0)
            setReady(true)
        }
        img.src = 'data:image/png;base64,' + b64
    }, [b64])

    const readAt = (clientX: number, clientY: number) => {
        const c = canvasRef.current
        if (!c || !ready) return null
        const r = c.getBoundingClientRect()
        if (!r.width || !r.height) return null
        const x = Math.max(0, Math.min(c.width - 1, Math.floor((clientX - r.left) * c.width / r.width)))
        const y = Math.max(0, Math.min(c.height - 1, Math.floor((clientY - r.top) * c.height / r.height)))
        const ctx = c.getContext('2d')
        if (!ctx) return null
        const x0 = Math.max(0, x - 1)
        const y0 = Math.max(0, y - 1)
        const w = Math.min(3, c.width - x0)
        const h = Math.min(3, c.height - y0)
        const d = ctx.getImageData(x0, y0, w, h).data
        let sr = 0, sg = 0, sb = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
            sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++
        }
        if (!n) return null
        return { x, y, rgb: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] }
    }

    const shown = picked ?? hover
    const c = canvasRef.current
    const rect = shown && c ? c.getBoundingClientRect() : null
    const scaleX = rect && c && c.width ? rect.width / c.width : 1
    const scaleY = rect && c && c.height ? rect.height / c.height : 1

    return (
        <div>
            <p style={{ fontSize: 12, opacity: 0.85 }}>
                下面是游戏窗口截图。把鼠标移到怪物名字文字上查看颜色，点击选中，再点「应用此颜色」。取 3×3 小块平均值，减少文字抗锯齿的偏差；应用后仍可手动微调 RGB。
            </p>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
                <canvas
                    ref={canvasRef}
                    style={{ maxWidth: '100%', display: 'block', cursor: 'crosshair' }}
                    onMouseMove={e => setHover(readAt(e.clientX, e.clientY))}
                    onMouseLeave={() => setHover(null)}
                    onClick={e => setPicked(readAt(e.clientX, e.clientY))}
                />
                {shown && (
                    <div style={{
                        position: 'absolute',
                        left: shown.x * scaleX - 5,
                        top: shown.y * scaleY - 5,
                        width: 10, height: 10,
                        border: '2px solid #fff', boxSizing: 'border-box', pointerEvents: 'none',
                        boxShadow: '0 0 0 1px #000'
                    }} />
                )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                    width: 28, height: 28, border: '1px solid #888',
                    background: shown ? `rgb(${shown.rgb[0]},${shown.rgb[1]},${shown.rgb[2]})` : 'transparent'
                }} />
                <div style={{ fontSize: 12 }}>
                    {shown
                        ? `R ${shown.rgb[0]} · G ${shown.rgb[1]} · B ${shown.rgb[2]}（X ${shown.x} · Y ${shown.y}）${picked ? ' · 已选中' : ' · 悬停预览'}`
                        : '尚未选取颜色'}
                </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <div className="btn sm" onClick={() => { if (picked) onPick(picked.rgb) }}>应用此颜色</div>
                <div className="btn sm" onClick={onCancel}>取消</div>
            </div>
        </div>
    )
}
