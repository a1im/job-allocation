import { EventEmitter } from 'events';
import { parseBaseError } from 'parse-base-error';
import { JAWorker } from '../worker/JAWorker';
import { JAEvent, JAEventData, JAJob } from '../worker/types';

const GLOBAL_WATCH_NAME = 'GLOBAL_WATCH_NAME';

export const createGlobalWatch = <
    Worker extends JAWorker<any>,
>(worker: Worker) => {
    type JobData = Worker extends JAWorker<infer P> ? P : unknown;
    const emitter = new EventEmitter();
    const globalWatchRemoteQueue = worker.remoteQueue.factoryNestedRemoteQueue<JAJob<JobData>>(GLOBAL_WATCH_NAME);
    const globalWatchWorker = new JAWorker({
        remoteQueue: globalWatchRemoteQueue,
        action: async (job) => {
            emitter.emit('job', job.data);
        },
        concurrency: worker.concurrency,
    });
    const workerOnResult = async ({ job }: JAEventData) => {
        await globalWatchRemoteQueue.add(job!);
    };
    const workerOnError = async ({ error }: JAEventData) => {
        parseBaseError(error, 'createGlobalWatch workerOnError').log();
    };
    const on = (cb: (job: JAJob<JobData>) => Promise<void> | void) => {
        globalWatchWorker.start();
        emitter.on('job', cb);

        return () => emitter.off('job', cb);
    };
    const destroy = async () => {
        worker.off(JAEvent.JOB_RESULT, workerOnResult);
        worker.off(JAEvent.ERROR, workerOnError);
        emitter.removeAllListeners();
        await globalWatchRemoteQueue.clear();
        await globalWatchRemoteQueue.destroy();
        await globalWatchWorker.destroy();
    };

    worker.on(JAEvent.JOB_RESULT, workerOnResult);
    worker.on(JAEvent.ERROR, workerOnError);
    globalWatchWorker.on(JAEvent.ERROR, async ({ error }) => {
        parseBaseError(error, 'globalWatchWorker').log();
    });
    emitter.setMaxListeners(1000);
    emitter.on('error', (e) => {
        parseBaseError(e, 'globalWatch emitter').log();
    });

    return {
        destroy,
        on,
    };
};
