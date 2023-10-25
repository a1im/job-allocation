import type { JARedisRemoteQueue } from '../remoteQueue/JARedisRemoteQueue';
import type { JAJob } from '../worker/types';

export const updateJobActivity = async <T extends JAJob<any>>({
    queueJobs,
    job,
}: {
    queueJobs: JARedisRemoteQueue<any>
    job: T
}) => queueJobs.scopeRedisClient(async (redisClient) => {
    const jobStr = JSON.stringify(job);
    const newJob: T = JSON.parse(jobStr);
    let multi = await redisClient
        .multi()
        .lrem(queueJobs.key, 1, jobStr);

    newJob.lastRetryTimestamp = Date.now();
    multi = multi.rpush(queueJobs.key, JSON.stringify(newJob));

    await multi.exec();

    return newJob;
});
