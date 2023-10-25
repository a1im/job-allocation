import type { JARedisRemoteQueue } from '../remoteQueue/JARedisRemoteQueue';
import type { JAJob } from '../worker/types';

export const recoveryUnfinishedJobs = async ({
    queueJobs,
    queueRunningJobs,
    retryTimeout,
    retryCount = 3,
}: {
    queueJobs: JARedisRemoteQueue<any>
    queueRunningJobs: JARedisRemoteQueue<any>
    retryTimeout: number
    retryCount?: number
}) => {
    await queueRunningJobs.scopeRedisClient(async (redisClient) => {
        await redisClient.watch(queueRunningJobs.key);
        const dateNow = Date.now();

        try {
            const jobStr = await redisClient.lindex(
                queueRunningJobs.key,
                0,
            );

            if (jobStr) {
                const job = JSON.parse(jobStr) as JAJob<any>;
                const lastRetryTimestamp = job.lastRetryTimestamp ?? job.onCreated;
                const jobRetryTimeout = job.retryTimeout ?? retryTimeout;
                const jobRetryCount = job.retryCount ?? retryCount;
                const isRetryJob = Boolean(
                    jobRetryCount > 0
                    && jobRetryTimeout
                    && (lastRetryTimestamp + jobRetryTimeout) < dateNow,
                );
                const isRemoveJob = Boolean(
                    isRetryJob
                  || jobRetryCount <= 0
                  || !jobRetryTimeout,
                );

                if (isRemoveJob) {
                    let multi = await redisClient
                        .multi()
                        .lrem(queueRunningJobs.key, 1, jobStr);

                    if (isRetryJob) {
                        job.lastRetryTimestamp = dateNow;
                        job.retryCount = jobRetryCount - 1;
                        multi = multi.rpush(queueJobs.key, JSON.stringify(job));
                    }

                    await multi.exec();

                    await recoveryUnfinishedJobs({
                        queueJobs,
                        queueRunningJobs,
                        retryTimeout,
                        retryCount,
                    });
                } else {
                    await Promise.reject(new Error('unwatch'));
                }
            } else {
                await Promise.reject(new Error('unwatch'));
            }
        } catch (e) {
            await redisClient.unwatch();
        }
    });
};
