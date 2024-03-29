import { JAWorker } from '../worker/JAWorker';
import { createWorkerWatch } from './createWorkerWatch';
import { JAJob } from '../worker/types';
import { JARedisRemoteQueue } from '../remoteQueue/JARedisRemoteQueue';

export const createWaitJobsCompleted = <
    Worker extends JAWorker<any>,
    Queue extends JARedisRemoteQueue<any>,
>({ worker, queue }: {
    worker: Worker
    queue: Queue
}) => {
    type JobData = Worker extends JAWorker<infer P> ? P : unknown;
    const globalWatch = createWorkerWatch({
        worker,
        queue,
    });
    const waitJobsCompleted = async (
        jobs: JAJob<JobData>[],
        timeout?: number,
    ): Promise<JAJob<JobData>[]> => {
        if (!jobs.length) {
            return [];
        }
        const jobIds = jobs.map((it) => it.id);
        const resultJobs: JAJob<JobData>[] = [];
        let promiseResolve: (value?: unknown) => void;
        let promiseReject: (error: Error) => void;
        const promise = new Promise((resolve, reject) => {
            promiseResolve = resolve;
            promiseReject = reject;
        });
        const countJobs = jobs.length;
        const stop = globalWatch.on((job) => {
            if (jobIds.includes(job.id)) {
                resultJobs.push(job);
            }
            if (resultJobs.length >= countJobs) {
                promiseResolve();
            }
        });
        let timeoutId;

        if (timeout) {
            timeoutId = setTimeout(() => {
                promiseReject(new Error(`waitJobsCompleted: timeout ${resultJobs.length}`));
            }, timeout);
        }

        try {
            await promise;

            return resultJobs;
        } finally {
            clearTimeout(timeoutId);
            stop();
        }
    };
    const destroy = () => globalWatch.destroy();

    return {
        waitJobsCompleted,
        destroy,
    };
};
