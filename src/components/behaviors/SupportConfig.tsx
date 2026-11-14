import { createSlotBars, SupportConfigModel } from "../../models/BotConfig"
import { FrontendInfoModel } from "../../models/FrontendInfo"

import Modal from '../Modal'
import useModal from '../utils/UseModal'
import YesNoModal from '../YesNoModal'
import SlotBar from "../SlotBar"
import { StopWatchValues, useStopWatch } from "../utils/StopWatch"

import BooleanSlider from '../config/BooleanSlider'
import ConfigLabel from '../config/ConfigLabel'
import ConfigPanel from '../config/ConfigPanel'
import ConfigTable from '../config/ConfigTable'
import ConfigTableRow from '../config/ConfigTableRow'
import styled from "styled-components"
import { DefaultValuesChecker } from "../utils/DefaultValuesChecker"
import NumericInput from "../config/NumericInput"
import TimeInput from "../config/TimeInput"

type Props = {
    className?: string,
    info: FrontendInfoModel | null,
    config: SupportConfigModel,
    onChange: (config: SupportConfigModel) => void,
    botStopWatch: StopWatchValues | null,
    botState: string,


}

const SupportConfig = ({ className, info, config, onChange, botStopWatch, botState }: Props) => {
    const debugModal = useModal()
    const resetSlotYesNo = useModal(debugModal)
    const onDeathModal = useModal()
    const onAFKModal = useModal()

    const defaultValues = {
        'obstacle_avoidance_cooldown': 2000,
        'interval_between_buffs': 2000,
        'max_main_distance': 100,
    }

    DefaultValuesChecker(config, defaultValues, onChange)

    return (
        <div className={className}>
            <SlotBar botMode="support" config={config} onChange={onChange} />
            <YesNoModal isShowing={resetSlotYesNo.isShown} hide={resetSlotYesNo.close}
                title={<h4>确认重置所有技能槽？此操作不可撤销</h4>}
                onYes={() => {
                    const newConfig = { ...config, slot_bars: createSlotBars() }
                    onChange(newConfig)
                }} />
            <Modal isShowing={debugModal.isShown} hide={debugModal.close} title={<h4>设置</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        label={<ConfigLabel name="死亡事件" helpText="" />}
                        item={<button onClick={onDeathModal.open}>⚙️</button>}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="挂机事件" helpText="" />}
                        item={<button onClick={onAFKModal.open}>⚙️</button>}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="避让冷却" helpText="尝试避开障碍并开始移动模式前的等待时间。" />}
                        item={<TimeInput value={config.obstacle_avoidance_cooldown} onChange={value => onChange?.({ ...config, obstacle_avoidance_cooldown: value })} />}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="Buff 间隔" helpText="" />}
                        item={<TimeInput value={config.interval_between_buffs} onChange={value => onChange({ ...config, interval_between_buffs: value })} />}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="与主体最大距离" helpText="与主角色的最大距离。" />}
                        item={<NumericInput value={config.max_main_distance} onChange={value => onChange?.({ ...config, max_main_distance: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="是否在队伍中？" helpText="开启则给自己和上队长 buff。" />}
                        item={<BooleanSlider value={config.is_in_party ?? false} onChange={value => onChange?.({ ...config, is_in_party: value })} />}
                    />
                    <ConfigTableRow
                        label={<ConfigLabel name="重置所有技能槽" helpText="" />}
                        item={<button onClick={() => resetSlotYesNo.open()}>⚙️</button>}
                    />
                </ConfigTable>
            } />
            <Modal isShowing={onDeathModal.isShown} hide={onDeathModal.close}
                title={<h4>死亡行为</h4>} body={
                    <ConfigTable>
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="断开连接" helpText="开启则死亡后自动断开，否则按 ENTER 尝试复活。" />}
                            item={<BooleanSlider value={config.on_death_disconnect ?? true} onChange={value => onChange?.({ ...config, on_death_disconnect: value })} />}
                        />
                    </ConfigTable>
                } />

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
                            item={<TimeInput value={config.afk_timeout} onChange={value => onChange({ ...config, afk_timeout: value })} />}
                        />

                    </ConfigTable>
                } />

            {info && (
                <div className="info">
                    <div className="row">
                        <div>状态：{botState}</div>
                    </div>
                    <div className="row">
                        <div>挂机时长：{botStopWatch?.toString()}</div>
                    </div>
                    <div className="row">
                        <button className="btn sm" onClick={debugModal.open}>设置 ⚙️</button>
                    </div>

                </div>
            )}
        </div>
    )
}

export default styled(SupportConfig)`
`
