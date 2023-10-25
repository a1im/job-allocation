import type { JARedisRemoteQueue } from '../remoteQueue/JARedisRemoteQueue';
import type { JAJob } from '../worker/types';
import { updateJobActivity } from './updateJobActivity';

export const startJobActivity = <T extends JAJob<any>>({
    queueJobs,
    job,
    interval,
}: {
    queueJobs: JARedisRemoteQueue<any>
    job: T
    interval: number
}) => {
    let jobTmp = job;
    let timeout: ReturnType<typeof setTimeout>;
    const startUpdate = () => {
        timeout = setTimeout(async () => {
            jobTmp = await updateJobActivity({
                queueJobs,
                job: jobTmp,
            }).catch(() => jobTmp);
            startUpdate();
        }, interval);
    };

    startUpdate();

    return async () => {
        clearTimeout(timeout);
        await queueJobs.removeJob(jobTmp);
    };
};
