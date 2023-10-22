export interface JARedisRemoteStorageQueue {
    name: string
    tempName?: string
    blockingTimeout?: number
    prefix?: string
    port?: string | number
    host?: string
    connectionPool?: number
}
