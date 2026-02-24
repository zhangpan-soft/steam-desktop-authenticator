import path from "node:path";
import {app} from "electron";
import {JSONFileSyncPreset} from "lowdb/node";
import {LowSync, SyncAdapter} from "lowdb";
import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";
import {readFileSync, writeFileSync} from 'node:fs'

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


class SettingsDb {
    private db: LowSync<Settings>

    data: Settings

    constructor() {
        this.db = JSONFileSyncPreset<Settings>(
            path.join(app.getPath('userData'), 'settings.json'),
            getDefaultSettings()
        )
        this.db.read()
        this.data = this.db.data
    }

    update(){
        this.db.data = {...this.db.data, ...this.data}
        this.db.write()
        this.data = this.db.data
    }

}

const settingsDb = new SettingsDb()

class SteamAccountDb {
    private db: LowSync<SteamAccount>
    private passkey?: string
    private readonly adapter: SteamAccountAdapter

    data: SteamAccount

    constructor(account_name: string, passkey?: string) {
        this.passkey = passkey
        this.adapter = new SteamAccountAdapter(path.join(settingsDb.data.maFilesDir, `${account_name}.maFile`))
        this.db = new LowSync(this.adapter, {} as SteamAccount)
        this.db.read()
        this.data = this.db.data
    }

    update(){
        this.db.data = {...this.db.data, ...this.data}
        this.db.write()
        this.data = this.db.data
    }

    setPasskey(passkey?: string){
        if (this.passkey === passkey){
            return
        }
        this.passkey = passkey
        this.adapter.passkey = this.passkey
        this.db.write()
        this.db.read()
        this.data = this.db.data
    }
}

class SteamAccountAdapter implements SyncAdapter<SteamAccount> {
    private readonly filepath: string
    public passkey?: string

    private readonly ALGORITHM = 'aes-256-gcm';
    private readonly SALT_LEN = 16;
    private readonly IV_LEN = 12;
    private readonly KEY_LEN = 32;

    constructor(filepath: string, passkey?: string) {
        this.filepath = filepath;
        this.passkey = passkey
    }

    read() {
        try {
            const fileContent = readFileSync(this.filepath, 'utf8');

            // 如果没有设置密码，尝试直接按 JSON 解析
            // 场景：用户从未加密状态切换过来，或者文件本身未加密
            if (!this.passkey) {
                return JSON.parse(fileContent);
            }

            // 简单校验格式，避免对非加密文件强行解密报错
            const splits = fileContent.split('/')
            if (splits.length !== 4) {
                // 可能是普通 JSON 文件，尝试直接解析，如果失败则抛出解密错
                return JSON.parse(fileContent);
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

    write(data: SteamAccount) {
        if (!this.passkey) {
            writeFileSync(this.filepath, JSON.stringify(data), 'utf8');
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

class SteamAccountDbs {
    private dbs: Map<string, SteamAccountDb>

    constructor() {
        this.dbs = new Map<string, SteamAccountDb>()
    }

    db(account_name: string, passkey?: string): SteamAccountDb {
        if (this.dbs.has(account_name)) {
            const db: SteamAccountDb = this.dbs.get(account_name) as SteamAccountDb;
            db.setPasskey(passkey)
            return db as SteamAccountDb
        }
        const db = new SteamAccountDb(account_name, passkey)
        this.dbs.set(account_name, db)
        return db as SteamAccountDb
    }
}

const steamAccountDbs = new SteamAccountDbs()

export {
    settingsDb,
    steamAccountDbs,
    SteamAccountDb,
    SettingsDb
}
