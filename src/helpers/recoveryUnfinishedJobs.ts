import type { JARedisRemoteQueue } from '../remoteQueue/JARedisRemoteQueue';
import type { JAJob } from '../worker/types';

export const recoveryUnfinishedJobs = async ({
    queueJobs,
    queueRunningJobs,
    timeout,
}: {
    queueJobs: JARedisRemoteQueue<any>
    queueRunningJobs: JARedisRemoteQueue<any>
    timeout: number
}) => {
    await queueRunningJobs.scopeRedisClient(async (redisClient) => {
        await redisClient.watch(queueRunningJobs.key);
        const dateNow = Date.now();
        const [jobStr] = await redisClient.lrange(
            queueRunningJobs.key,
            0,
            0,
        );
        const job = jobStr
            ? JSON.parse(jobStr) as JAJob<any>
            : undefined;
        const lastRetryTimestamp = job?.lastRetryTimestamp ?? job?.onCreated;

        if (job && lastRetryTimestamp && (lastRetryTimestamp + timeout) < dateNow) {
            job.lastRetryTimestamp = dateNow;
            await redisClient
                .multi()
                .lrem(queueRunningJobs.key, 1, jobStr)
                .rpush(queueJobs.key, JSON.stringify(job))
                .exec();

            await recoveryUnfinishedJobs({
                queueJobs,
                queueRunningJobs,
                timeout,
            });
        } else {
            await redisClient.unwatch();
        }
    });
};
