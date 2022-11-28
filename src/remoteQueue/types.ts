import type Redis from 'ioredis';

export interface JARedisRemoteStorageQueue {
    name: string
    blockingTimeout?: number
    prefix?: string
    port?: string | number
    host?: string
    redisClient?: Redis
}
