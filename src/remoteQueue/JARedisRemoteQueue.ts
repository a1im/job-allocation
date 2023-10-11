import Redis from 'ioredis';
import { JAJob, JARemoteQueue } from '../worker/types';
import { JARedisRemoteStorageQueue } from './types';
import { parseNumber } from '../utils/parsers/parseNumber';
import { generateStorageKey } from '../helpers/generateStorageKey';
import { isArray } from '../utils/predicate/isArray';
import { createJAJob } from '../helpers/createJAJob';
import { createIORedis } from '../helpers/createIORedis';

export class JARedisRemoteQueue<Data> implements JARemoteQueue<Data> {
    protected readonly options: JARedisRemoteStorageQueue;

    protected readonly name;

    protected readonly prefix;

    protected readonly blockingTimeout;

    protected readonly redisOptions;

    protected readonly redisClients: Redis[] = [];

    protected readonly redisClientStack: Redis[] = [];

    constructor(options: JARedisRemoteStorageQueue) {
        const {
            name,
            blockingTimeout = 0,
            prefix = 'ja-remote-queue',
            host = 'localhost',
            port = '6379',
        } = options ?? {};

        this.options = options;
        this.name = name;
        this.blockingTimeout = blockingTimeout;
        this.prefix = prefix;
        this.redisOptions = {
            host,
            port: parseNumber(port),
        };
    }

    get key() {
        return generateStorageKey(
            this.prefix,
            this.name,
        );
    }

    async scopeRedisClient<T extends(redisClient: Redis) => Promise<any>>(cb: T): Promise<Awaited<ReturnType<T>>> {
        let redisClient = this.redisClientStack.pop();

        if (!redisClient) {
            redisClient = createIORedis(this.redisOptions);
            this.redisClients.push(redisClient);
        }

        try {
            const result = await cb(redisClient);

            return result;
        } finally {
            this.redisClientStack.push(redisClient);
        }
    }

    factoryNestedRemoteQueue(name: string) {
        const nestedRemoteQueue = new JARedisRemoteQueue<Data>({
            ...this.options,
            prefix: this.key,
            name,
        });

        return nestedRemoteQueue;
    }

    async pop() {
        return this.scopeRedisClient(async (redisClient) => {
            const items = await redisClient.blpop(
                this.key,
                this.blockingTimeout,
            );
            const unparsedItem = isArray(items)
                ? items[1]
                : items ?? undefined;
            const job = unparsedItem
                ? JSON.parse(unparsedItem) as JAJob<Data>
                : undefined;

            return job;
        });
    }

    async popMove(toKey: string) {
        return this.scopeRedisClient(async (redisClient) => {
            const item = await redisClient.blmove(
                this.key,
                toKey,
                'LEFT',
                'RIGHT',
                this.blockingTimeout,
            );
            const job = item
                ? JSON.parse(item) as JAJob<Data>
                : undefined;

            return job;
        });
    }

    async addJob(...job: JAJob<Data>[]) {
        if (job.length) {
            await this.scopeRedisClient(async (redisClient) => {
                await redisClient.rpush(
                    this.key,
                    ...job.map((it) => JSON.stringify(it)),
                );
            });
        }
    }

    async add(...data: Data[]) {
        const jobs = data.map((it) => createJAJob(it));

        await this.addJob(...jobs);

        return jobs;
    }

    async removeJob(job: JAJob<Data>) {
        const jobStr = JSON.stringify(job);

        return this.scopeRedisClient(async (redisClient) => {
            const res = await redisClient.lrem(
                this.key,
                1,
                jobStr,
            );

            return res;
        });
    }

    async count() {
        return this.scopeRedisClient(async (redisClient) => {
            const count = await redisClient.llen(this.key);

            return count;
        });
    }

    async clear() {
        await this.scopeRedisClient(async (redisClient) => {
            await redisClient.del(this.key);
        });
    }

    async destroy() {
        await Promise.all([
            ...this.redisClients.map((itRedisClient) => itRedisClient.disconnect()),
        ]);
    }
}
