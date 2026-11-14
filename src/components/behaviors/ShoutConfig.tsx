import ConfigLabel from '../config/ConfigLabel'
import ConfigPanel from '../config/ConfigPanel'

import NumericInput from '../config/NumericInput'
import StringList from '../config/StringList'

import { ShoutConfigModel } from '../../models/BotConfig'
import ConfigTable from '../config/ConfigTable'
import ConfigTableRow from '../config/ConfigTableRow'
import { DefaultValuesChecker } from '../utils/DefaultValuesChecker'
import TimeInput from '../config/TimeInput'


type Props = {
    config: ShoutConfigModel,
    onChange: (config: ShoutConfigModel) => void,
}

const ShoutConfig = ({ config, onChange }: Props) => {
    const defaultValues = {
        'shout_interval': 30000,
    }

    DefaultValuesChecker(config, defaultValues, onChange)

    return (
        <>
            <ConfigPanel>
                <ConfigTable>
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="喊话内容" helpText="每行一条，可添加多条循环喊话。" />}
                        item={<StringList messages={config.shout_messages ?? []} onChange={value => onChange?.({ ...config, shout_messages: value })} />}
                    />
                    <ConfigTableRow
                        layout="v"
                        label={<ConfigLabel name="间隔" helpText="两次喊话间隔（毫秒）。" />}
                        item={<TimeInput value={config.shout_interval} onChange={value => onChange?.({ ...config, shout_interval: value })} />}
                    />
                </ConfigTable>
            </ConfigPanel>
        </>
    )
}

export default ShoutConfig;


