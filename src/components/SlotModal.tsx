import styled from 'styled-components'
import { cooldownSlotTypes, farmingSlotsBlacklist, SlotModel, SlotType, slotTypes, supportSlotsBlacklist, thresholdSlotTypes, translateDesc } from '../models/BotConfig'
import ConfigLabel from './config/ConfigLabel'
import ConfigTableRow from './config/ConfigTableRow'
import NumericInput from './config/NumericInput'
import Select from 'react-select'
import Modal from './Modal'
import ConfigTable from './config/ConfigTable'
import BooleanSlider from './config/BooleanSlider'
import TimeInput from './config/TimeInput'

type Props = {
    className?: string,
    isShowing: boolean,
    hide: () => void,
    index: number,
    slot?: SlotModel,
    onChange: (slot_bar_index:number, slot_index:number, slot:SlotModel) => void,
    barIndex: number,
    indexName: string,
    botMode: string,

}

const SlotModal = ({className, isShowing, hide, index, slot, onChange, barIndex, indexName, botMode}: Props) => {
    const blackList = botMode == "farming"? farmingSlotsBlacklist : supportSlotsBlacklist
    const options = slotTypes.map((type)=>{
        if (!blackList.includes(type))
        {
             return {value: type, label: translateDesc(type,"None")[1] }
        }
        return {}

    }).filter((item) => item.value != null )
        .sort((a,b) => {
            if (a.label !== undefined && b.label !== undefined) {
                return a.label.localeCompare(b.label);
            }
            return 0;
        } ) ;

    if (slot) {
        return(

            <Modal isShowing={isShowing} hide={hide} title={<h4>技能栏 F{barIndex + 1} - 第 {indexName} 格</h4>} body={
                <ConfigTable>
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="类型" helpText="选择绑定到当前技能格的动作。" />}
                        item={<div style={{width:'100%', color: 'black'}}><Select options={options} onChange={value => {slot.slot_type =  value?.value as SlotType || 'Unused';onChange(barIndex, index, slot)}} defaultValue={options.find(x => x.value == slot.slot_type)}/></div>}
                    />

                    {cooldownSlotTypes.includes(slot.slot_type) &&
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="冷却" helpText="两次使用之间的间隔，格式：hh:mm:ss:mss" />}
                            item={<TimeInput value={slot.slot_cooldown} onChange={value => {slot.slot_cooldown = value;onChange(barIndex, index, slot)}} />}
                        />
                    }

                    {thresholdSlotTypes.includes(slot.slot_type) &&
                        <ConfigTableRow
                            layout="v"
                            label={<ConfigLabel name="阈值" helpText="触发上限值。" />}
                            item={<NumericInput unit='%' value={slot.slot_threshold} onChange={value => {slot.slot_threshold = value;onChange(barIndex, index, slot)}} />}
                        />
                    }

                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="启用" />}
                        item={<BooleanSlider value={slot.slot_enabled ?? true} onChange={value => {slot.slot_enabled = value;onChange(barIndex, index, slot)}} />}
                    />
                </ConfigTable>
            }/>
    )
    }else {
        return(<></>)
    }

}


export default styled(SlotModal)`
& img.type {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: .25rem;
    border-radius: .25rem;
}
`


