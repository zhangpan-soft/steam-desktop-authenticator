import path from "node:path";
import {app} from "electron";
import {JSONFilePreset} from "lowdb/node";
import {Adapter, Low} from "lowdb";
import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";
import {constants} from 'node:fs'

// --- 1. Settings 定义 ---
// 将 path 计算移出顶层，防止 app.ready 前调用崩溃
function getDefaultSettings(): Settings {
    return {
        encrypted: false,
        first_run: true,
        periodic_checking: false,
        periodic_checking_interval: 5,
        periodic_checking_checkall: false,
        auto_confirm_market_transactions: false,
        auto_confirm_trades: false,
        maFilesDir: path.join(app.getPath('userData'), 'maFiles'), // ✅ 安全：只在调用时执行
        entries: [],
        proxy: undefined,
        timeout: 10_000
    };
}

let settingsDb: Low<Settings>

export async function getSettingsDb(): Promise<Low<Settings>> {
    if (settingsDb) return settingsDb
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    // ✅ 调用函数获取默认值
    settingsDb = await JSONFilePreset<Settings>(settingsPath, getDefaultSettings())
    return settingsDb
}

// --- 2. SteamAccount DB ---

// 定义缓存：Key 是账号名，Value 是 Low 实例
const steamAccountsDb: { [key: string]: Low<SteamAccount> } = {}

/**
 * 获取 Steam 账号数据库
 * @param account_name 账号名
 * @param passkey 解密密码
 * @returns 返回 Low 实例，如果文件不存在则抛出错误 (或返回 null，看你喜好)
 */
export async function getSteamAccountDb(account_name: string, passkey?: string): Promise<Low<SteamAccount>> {
    // 1. 先查缓存
    // 如果缓存里有，说明之前成功读取过，直接返回
    if (steamAccountsDb[account_name]) {
        return steamAccountsDb[account_name]
    }

    const sdb = await getSettingsDb()
    const steamAccountPath = path.join(sdb.data.maFilesDir, `${account_name}.maFile`)

    // 2. ✨ 关键步骤：显式检查文件是否存在
    try {
        // F_OK 用于检查文件是否存在
        await fs.access(steamAccountPath, constants.F_OK);
    } catch {
        // 🚨 如果文件不存在，直接抛出业务错误
        // 这样业务方就知道："哦，这个账号还没有数据，我要走新建流程"
        throw new Error(`ACCOUNT_NOT_FOUND: Account file for ${account_name} does not exist.`);
    }

    // 3. 文件存在，才初始化 Adapter 和 Low
    const adapter = new EncryptedJSONAdapter<SteamAccount>(steamAccountPath, passkey);

    // 这里传入 undefined 是安全的，因为我们已经确认文件存在，read() 一定会读到东西
    // 如果 read() 读出来是 null (比如文件是空的)，Lowdb 才会用到这个 undefined
    const lowDb = new Low<SteamAccount>(adapter, {} as SteamAccount);

    await lowDb.read();
    console.log('filename', steamAccountPath)
    console.log('lowDb', lowDb.data)

    // 4. 只有读取成功后，才写入缓存
    steamAccountsDb[account_name] = lowDb;

    return lowDb;
}

/**
 * 新增一个辅助函数：用于创建新账号
 * 因为 getSteamAccountDb 现在不负责创建了，你需要一个专门的方法来初始化
 */
export async function createSteamAccountDb(account_name: string, initialData: SteamAccount, passkey?: string): Promise<Low<SteamAccount>> {
    const sdb = await getSettingsDb()
    const steamAccountPath = path.join(sdb.data.maFilesDir, `${account_name}.maFile`)

    // 检查是否已存在，防止覆盖
    try {
        await fs.access(steamAccountPath, constants.F_OK);
        throw new Error(`ACCOUNT_EXISTS: Account ${account_name} already exists.`);
    } catch (e: any) {
        // 如果错误不是 ENOENT (文件不存在)，说明是其他 IO 错误，抛出
        if (e.code !== 'ENOENT' && !e.message.includes('ACCOUNT_EXISTS')) throw e;
        if (e.message.includes('ACCOUNT_EXISTS')) throw e;
    }

    const adapter = new EncryptedJSONAdapter<SteamAccount>(steamAccountPath, passkey);
    const lowDb = new Low<SteamAccount>(adapter, initialData);

    // 立即写入磁盘，创建文件
    await lowDb.write();

    // 写入缓存
    steamAccountsDb[account_name] = lowDb;

    return lowDb;
}

// --- 3. 加密适配器 (你的逻辑已非常完美) ---

class EncryptedJSONAdapter<T> implements Adapter<T> {
    private filepath: string;
    private passkey?: string;

    private readonly ALGORITHM = 'aes-256-gcm';
    private readonly SALT_LEN = 16;
    private readonly IV_LEN = 12;
    private readonly KEY_LEN = 32;

    constructor(filepath: string, passkey?: string) {
        this.filepath = filepath;
        this.passkey = passkey
    }

    async read(): Promise<T | null> {
        try {
            const fileContent = await fs.readFile(this.filepath, 'utf8');

            // 如果没有设置密码，尝试直接按 JSON 解析
            // 场景：用户从未加密状态切换过来，或者文件本身未加密
            if (!this.passkey) {
                return JSON.parse(fileContent);
            }

            // 简单校验格式，避免对非加密文件强行解密报错
            const splits = fileContent.split('/')
            if (splits.length !== 4) {
                // 可能是普通 JSON 文件，尝试直接解析，如果失败则抛出解密错
                try {
                    return JSON.parse(fileContent);
                } catch {
                }
                throw new Error('Invalid encrypted file format');
            }

            const iv = Buffer.from(splits[0], 'hex');
            const salt = Buffer.from(splits[1], 'hex');
            const tag = Buffer.from(splits[2], 'hex');
            const encryptedText = splits[3];

            // 关键：使用文件中的 Salt 重新派生 Key
            const key = crypto.scryptSync(this.passkey, salt, this.KEY_LEN);

            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
            decipher.setAuthTag(tag)

            // ✅ update 的输入是 'hex' (对应 write 时的 output encoding)
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted)
        } catch (e: any) {
            if (e.code === 'ENOENT') return null;
            // 区分是解密失败还是 JSON 解析失败
            throw new Error(`Failed to load database: ${e.message}`);
        }
    }

    async write(data: T): Promise<void> {
        if (!this.passkey) {
            await fs.writeFile(this.filepath, JSON.stringify(data), 'utf8');
            return;
        }

        const iv = crypto.randomBytes(this.IV_LEN)
        const salt = crypto.randomBytes(this.SALT_LEN)
        // 关键：每次写入生成新的 Salt -> 新的 Key
        const key = crypto.scryptSync(this.passkey, salt, this.KEY_LEN);

        const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

        // ✅ update 输出 'hex'，这样文件体积小且无特殊字符
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag().toString('hex');

        // 格式：IV / SALT / TAG / CONTENT
        return fs.writeFile(
            this.filepath,
            `${iv.toString('hex')}/${salt.toString('hex')}/${tag}/${encrypted}`,
            'utf8'
        );
    }
}
