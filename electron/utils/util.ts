/**
 * 将混杂任意字符的特定格式时间字符串，解析并转换为本地 Date 对象
 * @param {string} rawStr - 例如 "xxx2024xxx1xxx1xxx13xxx13xxx13,xxx8xxx00xxx00xxx"
 * @returns {Date | null} 本地时间对象
 */
function parseToLocalTime(rawStr: string): Date | null {
    // 1. 使用正则全局匹配提取所有数字（加上 -? 是为了兼容比如西五区 "-5" 这样的负数时区）
    const matchResult = rawStr.match(/-?\d+/g);

    // 校验是否成功提取了至少 9 个数字
    if (!matchResult || matchResult.length < 9) {
        console.error('字符串格式有误，无法提取完整的 9 个时间参数');
        return null;
    }

    // 2. 解构并全部转换为数字类型
    const [year, month, day, hour, minute, second, offsetH, offsetM, offsetS] = matchResult.map(Number);

    // 3. 计算 UTC 时间戳
    // 注意：month - 1 是因为 Date.UTC 的月份是从 0 开始的
    const assumedUtcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);

    // 4. 计算时区偏移（毫秒）并修正为真实 UTC 时间戳
    const sign = offsetH < 0 ? -1 : 1;
    const offsetMs = (offsetH * 3600 + sign * (offsetM * 60 + offsetS)) * 1000;
    const realUtcTimestamp = assumedUtcTimestamp - offsetMs;

    // 5. 返回 Date 对象（它会自动根据当前设备系统时区展示）
    return new Date(realUtcTimestamp);
}
