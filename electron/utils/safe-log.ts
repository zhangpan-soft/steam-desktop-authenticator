const SENSITIVE_KEY_PATTERN = /(access[_-]?token|refresh[_-]?token|shared[_-]?secret|identity[_-]?secret|secret|cookie|passkey|password|authorization|steamguard)/i

function sanitizeValue(value: any, depth = 0): any {
    if (value === undefined || value === null) {
        return value
    }
    if (depth > 3) {
        return '[Truncated]'
    }
    if (typeof value === 'string') {
        return value.length > 500 ? `${value.slice(0, 500)}...` : value
    }
    if (typeof value !== 'object') {
        return value
    }
    if (Array.isArray(value)) {
        return value.slice(0, 10).map(item => sanitizeValue(item, depth + 1))
    }

    const sanitized: Record<string, any> = {}
    for (const [key, item] of Object.entries(value)) {
        sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
            ? '[Redacted]'
            : sanitizeValue(item, depth + 1)
    }
    return sanitized
}

export function toSafeError(error: any) {
    if (!error) {
        return {message: 'Unknown error'}
    }

    return {
        name: error.name,
        message: error.message || String(error),
        code: error.code,
        statusCode: error.response?.statusCode,
        url: error.request?.requestUrl || error.options?.url?.toString?.(),
        method: error.options?.method,
        responseBody: typeof error.response?.body === 'string'
            ? error.response.body.slice(0, 500)
            : sanitizeValue(error.response?.body),
    }
}

export function safeErrorMessage(error: any, fallback = 'Unknown error') {
    return error?.message || error?.code || fallback
}
