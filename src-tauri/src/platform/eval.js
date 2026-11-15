const client = document.querySelector('canvas')
const input = document.querySelector('input')
// 调试叠层由 Rust 端通过 window.__NEUZ_DEBUG 实时开关（0.16.25 起），
// 不再依赖编译期 $env.DEBUG，方便用户随时开启观察点击落点。
function addTargetMarker(color = 'red', x = 0, y = 0,) {
    if (!window.__NEUZ_DEBUG) return
    const targetMarker = document.createElement('div')
    const targetMarkerStyle = `position: fixed; width: 4px; height: 4px; background-color: ${color}; border-radius: 50%;z-index: 10000;left: ${x - 2}px;top: ${y - 2}px;`
    targetMarker.style = targetMarkerStyle
    document.body.appendChild(targetMarker)

    setTimeout(() => {
        targetMarker.remove()
    }, 1200)
}

// 画一个矩形框标记检测到的怪物名字区域（绿色），帮助判断点击落点是否在怪身上。
function drawMobBox(x, y, w, h) {
    if (!window.__NEUZ_DEBUG) return
    const d = document.createElement('div')
    const s = `position: fixed; left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px; border: 1px solid lime; box-sizing: border-box; z-index: 9998; pointer-events: none;`
    d.style = s
    document.body.appendChild(d)
    setTimeout(() => d.remove(), 1200)
}

function isMob() {
    return document.body.style.cursor.indexOf('curattack') > 0
}
function dispatchEvent(event) {
    return client.dispatchEvent(event)
}

function after(duration = 0, callback) {
    setTimeout(callback, duration)
}

let checkMobTimeout = null;
function mouseEvent(type, x, y, { checkMob = false, delay = 50, duration } = {}) {
    if (checkMobTimeout) {

        clearTimeout(checkMobTimeout)
        checkMobTimeout = null
    }
    function waitDuration(type) {
        if (duration) {
            after(duration, () => {
                dispatchEvent(new MouseEvent(type ?? 'mouseup', { clientX: x, clientY: y }))
            })
        } else if (type) {
            dispatchEvent(new MouseEvent(type, { key }))
        }
    }
    switch (type) {
        case 'move':
            dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }))
            break;
        case 'press':
            dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y }))
            waitDuration('mouseup')
            break;
        case 'hold':
            dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y }))
            waitDuration()
            break;
        case 'release':
            dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y }))
            break;
            case 'moveClick':
            dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }))

            if (checkMob) {
                checkMobTimeout = setTimeout(() => {
                    if (isMob()) {
                        dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y }))
                        dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y }))
                        addTargetMarker('green', x, y)
                    } else {
                        addTargetMarker('red', x, y)
                    }
                }, delay)
            } else if (!checkMob) {
                addTargetMarker('blue', x, y)
                // 0.16.9 能正常打怪、0.16.17+ 打不了的根因：原本的点击延迟被去掉了。
                // Unity WebGL 的输入循环在「下一帧」才处理 mousemove 的悬停命中，
                // 若 mousedown/up 与 mousemove 同步紧跟着派发，引擎会按「旧指针位置」
                // 做命中测试，结果点不到怪 → 不选中、不攻击。
                // 这里与 0.16.9 的 checkMob 路径一致，留出 ~delay 毫秒让游戏先
                // 处理完悬停再真正按下（isMob() 在 0.16.9 能变 true 即证明
                // 合成 mousemove 确实更新了游戏悬停态，只是需要这一帧的时间差）。
                // 0.16.21 教训：该游戏只认纯 MouseEvent，注入 PointerEvent 会被
                // 当成第二次点击把选中取消掉（0.16.21 全废的原因），禁止再叠加。
                setTimeout(() => {
                    dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y }))
                    dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y }))
                }, delay)
            }
            break;
    }
}
function keyboardEvent(keyMode, key, duration = null) {
    function waitDuration(type) {
        if (duration) {
            setTimeout(() => {
                dispatchEvent(new KeyboardEvent(type ?? 'keyup', { key }))
            }, duration)
        } else if (type) {
            dispatchEvent(new KeyboardEvent(type, { key }))
        }
    }
    switch (keyMode) {
        case 'press':
            dispatchEvent(new KeyboardEvent('keydown', { key }))
            waitDuration('keyup')
            break;
        case 'hold':
            dispatchEvent(new KeyboardEvent('keydown', { key }))
            waitDuration()
            break;
        case 'release':
            dispatchEvent(new KeyboardEvent('keyup', { key }))
            break;

    }
}

function sendSlot(slotBarIndex, slotIndex) {
    keyboardEvent('press', `F${slotBarIndex + 1}`)
    keyboardEvent('press', slotIndex)
}

function setInputChat(text) {
    input.value = text
    input.select()
}
