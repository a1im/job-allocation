import { JAJob, JAJobStatus } from '../worker/types';

export const parseJAJobCompleted = ({
    job,
    returnData,
}: {
    job: JAJob<any>
    returnData: any
}): JAJob<undefined> => ({
    ...job,
    onFinished: Date.now(),
    status: JAJobStatus.COMPLETED,
    returnData,
});
