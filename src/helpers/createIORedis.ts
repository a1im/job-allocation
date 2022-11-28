import Redis, { RedisOptions } from 'ioredis';
import { parseBaseError } from 'parse-base-error';

export const createIORedis = (options: RedisOptions) => {
    const redis = new Redis({
        retryStrategy(times) {
            const delay = Math.min(times * 200, 2000);

            return delay;
        },
        maxRetriesPerRequest: null,
        ...options,
    });

    redis.on('error', (error) => {
        parseBaseError(error, 'createIORedis').log();
    });

    return redis;
};
