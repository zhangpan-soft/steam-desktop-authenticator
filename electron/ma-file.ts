import * as crypto from 'crypto';
import path from "node:path";
import * as fs from 'node:fs/promises';
import globalStore from "./store";

export interface EncryptionData {
    salt: string; // Base64 string from manifest.json
    iv: string;   // Base64 string from manifest.json
    encryptedContent: string; // The content of the .maFile (Base64 or raw text)
}

export class SDAFileEncryptor {
    // SDA C# 源码中 Rfc2898DeriveBytes 的默认迭代次数通常是 50000
    private static readonly ITERATIONS = 50000;
    private static readonly KEY_SIZE = 32; // AES-256 needs 32 bytes
    private static readonly HASH_ALGO = 'sha1'; // .NET Rfc2898DeriveBytes 默认使用 SHA1

    /**
     * 解密 maFile 内容
     * @param encryptedData 加密的数据字符串 (通常是 .maFile 的文件内容)
     * @param password 用户设置的加密密码
     * @param saltBase64 manifest.json 中的 encryption_salt
     * @param ivBase64 manifest.json 中的 encryption_iv
     */
    public static decrypt(
        encryptedData: string,
        password: string,
        saltBase64: string,
        ivBase64: string
    ): string {
        try {
            const salt = Buffer.from(saltBase64, 'base64');
            const iv = Buffer.from(ivBase64, 'base64');

            // 1. 派生密钥 (Key Derivation)
            // 对应 C#: new Rfc2898DeriveBytes(password, salt, 50000)
            const key = crypto.pbkdf2Sync(
                password,
                salt,
                this.ITERATIONS,
                this.KEY_SIZE,
                this.HASH_ALGO
            );

            // 2. 创建解密器 (AES-256-CBC)
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            decipher.setAutoPadding(true); // C# 默认使用 PKCS7 padding

            // 3. 执行解密
            // 注意：SDA 的 encryptedData 通常是 Base64 编码的
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new Error(`解密失败: 密码错误或数据损坏. 详情: ${(error as Error).message}`);
        }
    }

    /**
     * 加密数据 (用于生成新的 maFile)
     * @param plainText 原始 maFile JSON 字符串
     * @param password 加密密码
     * @returns 包含加密内容、新生成的 Salt 和 IV 的对象
     */
    public static encrypt(plainText: string, password: string): EncryptionData {
        // 1. 生成随机 Salt (8字节是 .NET 默认，但也常建议 16字节，这里用 8 字节以匹配旧版兼容性)
        // 建议检查 manifest 中现有的 salt 长度，通常是 8 或 16 字节
        const salt = crypto.randomBytes(8);

        // 2. 生成随机 IV (AES block size = 16 bytes)
        const iv = crypto.randomBytes(16);

        // 3. 派生密钥
        const key = crypto.pbkdf2Sync(
            password,
            salt,
            this.ITERATIONS,
            this.KEY_SIZE,
            this.HASH_ALGO
        );

        // 4. 创建加密器
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

        // 5. 执行加密
        let encrypted = cipher.update(plainText, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        return {
            salt: salt.toString('base64'),
            iv: iv.toString('base64'),
            encryptedContent: encrypted
        };
    }
}

export async function readMaFile(maFilePath: string, options?:{passkey?: string, iv?: string | null, salt?: string | null}):Promise<{
    account_name: string,
    maFileFilename: string,
    maFileContent: string,
    data: SteamAccount
}>{
    const maFileParse = path.parse(maFilePath)
    if (options && options?.passkey){
        const _ = await fs.readFile(maFilePath, 'utf8')
        const data = SDAFileEncryptor.decrypt(_, options.passkey, options?.salt||'', options?.iv||'')
        const _data = JSON.parse(data)
        return {
            account_name: _data.account_name,
            maFileFilename: maFileParse.base,
            maFileContent: data,
            data: _data
        }
    } else {
        const data = await fs.readFile(maFilePath, 'utf8')
        console.log('=================', data)
        const _data = JSON.parse(data)
        return {
            account_name: _data.account_name,
            maFileFilename: maFileParse.base,
            maFileContent: data,
            data: _data
        }
    }
}

export async function saveMaFile(content: string, password?:string){

    const state = globalStore.getState()
    await exists(state.settings.maFilesDir).then(f=>{
        if (!f){
            return fs.mkdir(state.settings.maFilesDir,{recursive: true});
        }
    }).then()
    const _ = JSON.parse(content)
    const account_name = _.account_name
    const steamid = _.Session?.SteamID
    const _entry:EntryType = {
        steamid,
        filename: `${account_name}.maFile`,
        encryption_iv: null,
        encryption_salt: null,
        account_name: _.account_name
    }
    if (password){
        const encrypted = SDAFileEncryptor.encrypt(content, password)
        _entry.encryption_iv = encrypted.iv
        _entry.encryption_salt = encrypted.salt
        await fs.writeFile(path.join(state.settings.maFilesDir,_entry.filename), encrypted.encryptedContent, 'utf8')
    } else {
        await fs.writeFile(path.join(state.settings.maFilesDir,_entry.filename), content, 'utf8')
    }
    let index = -1

    for (let i = 0; i < state.settings.entries.length; i++) {
        if (state.settings.entries[i].steamid === steamid){
            index = i
            break
        }
    }
    if (index > -1){
        state.settings.entries[index] = _entry
    } else {
        state.settings.entries.push(_entry)
    }
    globalStore.updateState('settings', 'entries', state.settings.entries)
}

const exists = async (p: string)=>{
    return fs.access(p).then(()=>true).catch(()=>false)
}
