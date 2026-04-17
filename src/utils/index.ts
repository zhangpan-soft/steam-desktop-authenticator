/**
 * 等待指定的毫秒数
 * @param ms 毫秒
 */
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
